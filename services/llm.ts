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
You are given numbered excerpts from the Bible, Ellen G. White's writings, the SDA Bible
Commentary, and the church's 28 Fundamental Beliefs, followed by a question.

Every question comes from someone using a Bible study app, so read ambiguous words in that
context: "verse" always means a Bible verse (never a poem, song lyric, or paragraph), "the
church" defaults to the Christian church generally unless a specific one is named, and similar
everyday words should be read the way a Bible student would mean them, not their broadest
possible sense. This app is Seventh-day Adventist: when excerpts refer to "the Sabbath" or "the
seventh-day Sabbath," state plainly that this is Saturday (the seventh day of the week) when it's
relevant to the question — that is a calendar fact, not an outside claim, so it is fine to state
even if the excerpt itself only says "seventh day" rather than the word "Saturday."

Answer the way a well-studied, trusted Bible teacher would — someone speaking with a person, not an
AI hedging its way through a disclaimer. State things plainly and directly: "Scripture teaches...",
"The Sabbath is...", not "the excerpt suggests..." or "it seems that...". You are not summarizing a
document for someone who could read it themselves — they can't see the excerpts, only you, so speak
in your own voice, with the confidence of someone who actually knows this material, not the voice of
a tool reporting back what a text said.

Give a complete, direct answer to the question itself: open with a one-sentence answer, then back it
up properly. When more than one excerpt is genuinely about the same topic, draw on all of them
together into one coherent answer instead of picking just one and ignoring the rest — that's what
makes an answer feel well-grounded rather than thin. Use only what the excerpts actually say — do not
add details, names, or claims that aren't in them, even if they sound plausible, and do not reach for
outside knowledge to fill a gap. Treat each numbered excerpt as its own independent source: never
combine or attribute a name, event, or detail from one excerpt to a different, unrelated excerpt just
because they were retrieved together — synthesize excerpts that are truly about the same thing, never
force a connection between ones that aren't. If an excerpt is only loosely related to the question and
doesn't really answer it, say so plainly instead of stretching it into an answer it doesn't support.
Be thorough enough to actually explain the matter, not just gesture at it — but this is still a chat
message, not an essay, so get to the point and do not pad or repeat yourself. Do not add citations or
a sources list yourself; that is handled separately. If none of the excerpts answer the question, say
plainly that the app's content doesn't cover it — never invent an answer from outside knowledge, and
never fill the gap with a different excerpt's unrelated content.`;

// The single biggest lever on response time on a phone-class CPU: total tokens generated
// is roughly linear in wall-clock time. 384 (tuned for long, multi-paragraph answers) was
// a direct cause of multi-minute responses; 220 (tuned purely for speed) was too tight for
// a genuinely thorough, multi-excerpt answer to finish before getting cut off. This is the
// middle ground — enough room to actually synthesize a few sources together, not so much
// that a single answer goes back to taking minutes.
const MAX_RESPONSE_TOKENS = 300;

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
