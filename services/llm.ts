import { Platform } from 'react-native';
import type { initLlama as InitLlama, LlamaContext, RNLlamaOAICompatibleMessage, TokenData } from 'llama.rn';
import type { SearchChunk } from '@/database/searchIndex';

let contextPromise: Promise<LlamaContext> | null = null;
let contextModelPath: string | null = null;

// One shared context for the app's lifetime — reloading an ~800MB model on every
// question would make each answer as slow as the first. Cleared on failure so a later
// retry doesn't get stuck reusing a broken load. The require() is deferred to first
// call (never a static top-level import) — aiAssistant.ts only reaches this after its
// AI_INFERENCE_AVAILABLE check, matching how services/notifications.ts avoids ever
// loading a native module's JS in Expo Go, where merely requiring one can crash the app.
//
// Keyed on modelPath (not just "is there a context yet") because the active model can
// now change mid-session — a user can switch between the downloaded model and an
// imported one (see aiModel.ts's ModelSourceKind) without restarting the app. Switching
// releases the previous context's native memory before loading the new one rather than
// leaking an ~800MB+ model still resident just because nothing referenced it anymore.
function getContext(modelPath: string): Promise<LlamaContext> {
  if (contextPromise && contextModelPath === modelPath) return contextPromise;

  const staleContext = contextPromise;
  contextModelPath = modelPath;
  const { initLlama }: { initLlama: typeof InitLlama } = require('llama.rn');
  contextPromise = (staleContext ? staleContext.then((ctx) => ctx.release()).catch(() => {}) : Promise.resolve())
    .then(() =>
      initLlama({
        model: modelPath,
        // Sized for this app's actual worst case: system prompt (~200 tokens) + 5 excerpts
        // (~550 chars/~140 tokens each) + question + up to 2 prior history turns (each
        // answer capped at MAX_RESPONSE_TOKENS, no continuation turn — see MAX_SECTIONS)
        // comfortably tops out under 3,000 tokens. n_ctx sizes the KV cache, it doesn't
        // change per-token compute, so this is a memory-sizing choice, not a speed one.
        n_ctx: 3072,
        // Prompt prefill (unlike token-by-token decode) is compute-bound and parallelizes
        // well, so more threads meaningfully cuts time-to-first-token on multi-core phones —
        // decode itself is memory-bandwidth-bound and won't scale much past this, but it
        // doesn't hurt it either.
        n_threads: 6,
        // GPU (VRAM) offload is only wired up for iOS/Metal in this llama.rn build —
        // Android falls back to CPU regardless of this value, so only set it where it
        // actually does something.
        ...(Platform.OS === 'ios' ? { n_gpu_layers: 99 } : {}),
      })
    )
    .catch((err: unknown) => {
      contextPromise = null;
      contextModelPath = null;
      throw err;
    });
  return contextPromise;
}

// Deliberately does NOT ask the model to cite [1]/[2] inline — a 1B model given both
// "answer the question" and "interleave citation markers" as jobs at once tends to
// degrade toward just emitting the markers with little or no actual answer. Splitting
// the concerns is more reliable: the model's only job is to answer in plain language,
// and aiAssistant.ts deterministically appends a "Sources" list afterward — so the
// structure (real answer, then references below it) is guaranteed by code, not by
// hoping a small model follows a compound instruction.
//
// Kept deliberately short — unlike a cloud model, this is re-sent as fresh prefill on
// EVERY question with no KV-cache reuse between calls, so every word here is a fixed
// tax paid before the model even starts answering. An earlier, ~360-word version of
// this prompt was itself a meaningful share of total response time on a phone CPU;
// this trims it to the same behavioral rules with far less prose, not fewer rules.
const SYSTEM_PROMPT = `You are Hello C, an offline Bible study assistant in the AdventCompass app.
You're given numbered excerpts from the Bible, Ellen G. White's writings, the SDA Bible
Commentary, or the 28 Fundamental Beliefs, then a question.

This app is Seventh-day Adventist: "verse" means a Bible verse, and "the Sabbath"/"seventh-day
Sabbath" is Saturday — state that plainly when relevant, even if an excerpt just says "seventh
day."

Answer like a well-studied Bible teacher speaking directly to a person, not an AI hedging with
disclaimers ("Scripture teaches...", not "the excerpt suggests..."). Open with a one-sentence
answer, then back it up. Use only what the excerpts say — never add outside details or fabricate,
and never blend one excerpt's content into a different one just because they were retrieved
together; only combine excerpts that are genuinely on the same topic. If an excerpt doesn't really
answer the question, say so. Be thorough but concise — this is a chat reply, not an essay. Never
add citations or a sources list yourself; that's handled separately. If nothing here answers the
question, say plainly that the app's content doesn't cover it — don't invent an answer.`;

// The single biggest lever on response time on a phone-class CPU: total tokens generated
// is roughly linear in wall-clock time. 384 (tuned for long, multi-paragraph answers) was
// a direct cause of multi-minute responses; 220 (tuned purely for speed) was too tight for
// a genuinely thorough, multi-excerpt answer to finish before getting cut off. 300 was the
// next middle ground; trimmed slightly further here now that the system prompt and
// per-excerpt length are both cut too (see aiAssistant.ts) — the goal is for every one of
// these fixed costs to come down together rather than leaning on just one lever.
const MAX_RESPONSE_TOKENS = 260;

// If a section gets cut off by MAX_RESPONSE_TOKENS rather than finishing naturally, we
// ask the model to continue as a fresh turn and deliver the continuation as its own
// section/message. Kept at 1 (i.e. no continuation at all): each continuation re-sends the
// whole conversation so far and this llama.rn API re-prefills it from scratch (no KV-cache
// reuse across separate completion() calls) — a second section is a full extra prefill on
// top of the first, not a cheap resume, which is exactly the kind of cost that turns a
// slow answer into a multi-minute one. A tightened prompt targeting a shorter answer (see
// MAX_RESPONSE_TOKENS) should rarely need it; an answer that does get cut off just ends
// there rather than paying for a second full prefill to finish it.
const MAX_SECTIONS = 1;

// Loading the ~800MB model into memory (initLlama) is itself a real, multi-second-plus
// cost on a phone, and previously only ever started the moment the user sent their
// first question — meaning that load time landed directly on top of prefill+generation
// for whatever they typed first, compounding into exactly the kind of wait this whole
// file is trying to cut down. The AI Assistant screen calls this as soon as it knows
// offline mode is selected and a model is ready (see ai-assistant.tsx), so the load
// happens in the background while the user is still reading the greeting or typing,
// overlapping with time that would otherwise be spent doing nothing.
export function warmContext(modelPath: string): void {
  getContext(modelPath).catch(() => {});
}

export type SectionCallbacks = {
  onToken?: (partialText: string) => void; // live text of whichever section is currently generating
  onSection?: (sectionText: string, isLast: boolean) => void; // fires once per finished section
};

// A prior question/answer pair, fed back in as real conversation turns so a follow-up
// like "what about verse 17?" resolves against what was just discussed instead of being
// answered as a brand-new, context-free question.
export type ConversationTurn = { question: string; answer: string };

export async function answerFromContext(
  modelPath: string,
  question: string,
  chunks: SearchChunk[],
  callbacks?: SectionCallbacks,
  history: ConversationTurn[] = []
): Promise<string> {
  const context = await getContext(modelPath);

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
