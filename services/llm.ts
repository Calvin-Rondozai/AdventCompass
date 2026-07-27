import { Platform } from 'react-native';
import type { initLlama as InitLlama, LlamaContext, RNLlamaOAICompatibleMessage, TokenData } from 'llama.rn';
import { getModelPath } from './aiModel';
import type { SearchChunk } from '@/database/searchIndex';

let contextPromise: Promise<LlamaContext> | null = null;

// One shared context for the app's lifetime — reloading an ~800MB model on every
// question would make each answer as slow as the first. Cleared on failure so a later
// retry doesn't get stuck reusing a broken load. The require() is deferred to first
// call (never a static top-level import) — aiAssistant.ts only reaches this after its
// AI_INFERENCE_AVAILABLE check, matching how services/notifications.ts avoids ever
// loading a native module's JS in Expo Go, where merely requiring one can crash the app.
function getContext(): Promise<LlamaContext> {
  if (!contextPromise) {
    const { initLlama }: { initLlama: typeof InitLlama } = require('llama.rn');
    contextPromise = initLlama({
      model: getModelPath(),
      // Sized for this app's actual worst case, not a round number: system prompt (~90
      // tokens) + 3 excerpts (~550 chars/~140 tokens each) + question + up to 2 prior
      // history turns (each answer now up to MAX_RESPONSE_TOKENS), times up to MAX_SECTIONS
      // continuation turns (each re-sends the growing conversation) — comfortably tops out
      // under 4,000 tokens with the fuller answers the system prompt now asks for. 3072
      // fit the old, terser answer budget but risked context_full mid-answer on a
      // multi-section, multi-turn conversation now that answers run longer — n_ctx sizes
      // the KV cache, it doesn't change per-token compute, so this is a memory-sizing
      // choice, not a speed one.
      n_ctx: 4096,
      // Prompt prefill (unlike token-by-token decode) is compute-bound and parallelizes
      // well, so more threads meaningfully cuts time-to-first-token on multi-core phones —
      // decode itself is memory-bandwidth-bound and won't scale much past this, but it
      // doesn't hurt it either.
      n_threads: 6,
      // GPU (VRAM) offload is only wired up for iOS/Metal in this llama.rn build —
      // Android falls back to CPU regardless of this value, so only set it where it
      // actually does something.
      ...(Platform.OS === 'ios' ? { n_gpu_layers: 99 } : {}),
    }).catch((err: unknown) => {
      contextPromise = null;
      throw err;
    });
  }
  return contextPromise;
}

// Deliberately does NOT ask the model to cite [1]/[2] inline — a 1B model given both
// "answer the question" and "interleave citation markers" as jobs at once tends to
// degrade toward just emitting the markers with little or no actual answer. Splitting
// the concerns is more reliable: the model's only job is to answer in plain language,
// and aiAssistant.ts deterministically appends a "Sources" list afterward — so the
// structure (real answer, then references below it) is guaranteed by code, not by
// hoping a small model follows a compound instruction.
const SYSTEM_PROMPT = `You are Hello C, an offline Bible study assistant inside the AdventCompass app.
You are given numbered excerpts from the Bible, Ellen G. White's writings, and the SDA Bible
Commentary, followed by a question.

Give a complete, direct answer to the question itself — state the actual answer. Never just point
toward where it might be found, hint at it, or describe the excerpt instead of answering; the reader
already can't see the excerpts, only your answer. Use only what the excerpts say: open with a
one-sentence summary that directly answers the question, then explain it properly in your own
words — walk through the reasoning or detail the excerpts actually give, in a few full sentences,
the way you'd explain it to someone who wants to actually understand it, not just be pointed at it.
Long enough to be genuinely useful, short enough to stay a chat message, not an essay: a couple of
short paragraphs at most. Stay close to what the excerpts actually say — do not add details, names,
or claims that aren't in them, even if they sound plausible. If an excerpt is only loosely related to
the question and doesn't really answer it, say so plainly instead of stretching it into an answer it
doesn't support. Do not add citations or a sources list yourself; that is handled separately. If the
excerpts don't answer the question, say plainly that the app's content doesn't cover it; never invent
an answer from outside knowledge.`;

// Caps how long a single section takes to generate — the real lever on response time.
// A longer answer isn't lost, it just arrives as more sections (see MAX_SECTIONS below)
// instead of one long wait. Bumped up again (from 256) alongside the fuller-explanation
// system prompt above — asking for a properly explained answer and then cutting it off
// at the old, terser budget would just move the truncation earlier instead of fixing it.
const MAX_RESPONSE_TOKENS = 384;

// If a section gets cut off by MAX_RESPONSE_TOKENS rather than finishing naturally, we
// ask the model to continue as a fresh turn and deliver the continuation as its own
// section/message. Capped low deliberately: each continuation re-sends the whole
// conversation so far and this llama.rn API re-prefills it from scratch (no KV-cache
// reuse across separate completion() calls) — so every extra section is a full second
// (or third) prefill on top of the first, not a cheap resume.
const MAX_SECTIONS = 2;

export type SectionCallbacks = {
  onToken?: (partialText: string) => void; // live text of whichever section is currently generating
  onSection?: (sectionText: string, isLast: boolean) => void; // fires once per finished section
};

// A prior question/answer pair, fed back in as real conversation turns so a follow-up
// like "what about verse 17?" resolves against what was just discussed instead of being
// answered as a brand-new, context-free question.
export type ConversationTurn = { question: string; answer: string };

export async function answerFromContext(
  question: string,
  chunks: SearchChunk[],
  callbacks?: SectionCallbacks,
  history: ConversationTurn[] = []
): Promise<string> {
  const context = await getContext();

  const excerpts = chunks.map((c, i) => `[${i + 1}] (${c.title}) ${c.text}`).join('\n\n');
  const basePrompt = chunks.length
    ? `Excerpts:\n${excerpts}\n\nQuestion: ${question}`
    : `Question: ${question}\n\n(No matching excerpts were found in the app's content.)`;

  const messages: RNLlamaOAICompatibleMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.flatMap((turn): RNLlamaOAICompatibleMessage[] => [
      { role: 'user', content: turn.question },
      { role: 'assistant', content: turn.answer },
    ]),
    { role: 'user', content: basePrompt },
  ];

  const sections: string[] = [];
  for (let i = 0; i < MAX_SECTIONS; i++) {
    let accumulated = '';
    const result = await context.completion(
      // Lower temperature than a typical chat assistant on purpose — this is meant to
      // report what the source material says, not write creatively. Less randomness
      // means less drift from the actual excerpts (e.g. embellishing or generalizing
      // past what they support), at the cost of slightly more repetitive phrasing across
      // answers, which is the right trade for accuracy over personality here.
      { messages, n_predict: MAX_RESPONSE_TOKENS, temperature: 0.25 },
      callbacks?.onToken
        ? (data: TokenData) => {
            accumulated += data.token;
            callbacks.onToken!(accumulated);
          }
        : undefined
    );

    const sectionText = result.text.trim();
    sections.push(sectionText);
    const cutOffByLimit = !!result.stopped_limit && !result.stopped_eos;
    const isLast = !cutOffByLimit || i === MAX_SECTIONS - 1;
    callbacks?.onSection?.(sectionText, isLast);
    if (isLast) break;

    messages.push({ role: 'assistant', content: sectionText });
    messages.push({ role: 'user', content: 'Continue your answer from exactly where you left off; do not repeat anything or restart.' });
  }

  return sections.join('\n\n');
}
