import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { SQLiteDatabase } from 'expo-sqlite';
import { hasModel } from './aiModel';
import { answerFromContext, ConversationTurn } from './llm';
import { ensureSearchIndexBuilt, searchContent, SearchChunk } from '@/database/searchIndex';
import { getVerseRange } from '@/database/bible';
import { findScriptureRefs } from '@/database/scriptureRefs';
import { getKv } from '@/database/kv';
import { DEFAULT_TRANSLATION } from '@/database/translations';

// llama.rn is a native module — Expo Go (StoreClient) can never load it, only a
// development build can. Same check services/notifications.ts uses for its own
// native-module feature.
export const AI_INFERENCE_AVAILABLE = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

export type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string; sources?: SearchChunk[] };

// 5 (up from 3): a well-grounded, richly-backed answer needs more than one supporting
// excerpt to actually draw on — the system prompt now explicitly asks the model to
// synthesize every excerpt that's genuinely on-topic rather than picking just one, and it
// can't do that with too little material. This does cost more prefill time than 3 did;
// n_ctx and MAX_RESPONSE_TOKENS in llm.ts were both re-tuned to match.
const SEARCH_RESULT_LIMIT = 5;
// Raw-list requests ("give me verses about X") never touch the model — see wantsRawContent
// below — so there's no speed cost to returning more of them, only a straight SQL LIMIT.
const RAW_LIST_RESULT_LIMIT = 10;

// Small talk doesn't need the model spun up at all — matched and answered instantly,
// which also means these work even before the AI model has been downloaded. Only exact
// (normalized) matches trigger this; "hi, what does the bible say about hope" still goes
// through the real pipeline since there's an actual question attached.
const GREETING_REPLY =
  "Hi, I'm Hello C, your offline Bible study assistant. Ask me anything about the Bible, Ellen White's writings, commentary, or hymns already in the app, and I'll answer from what's here and show you exactly where it came from.";
const FAREWELL_REPLY = 'Goodbye! Come back anytime you have a question.';
const THANKS_REPLY = "You're welcome! Let me know if you have another question.";
// A question about the assistant itself isn't in the Bible/EGW/commentary content, so
// without this it fell through to the real search+model pipeline, found no relevant
// excerpts, and answered with some version of "the app's content doesn't cover that" —
// a poor answer to one of the most basic things someone asks a new assistant.
const IDENTITY_REPLY =
  "I'm Hello C, an offline Bible study assistant built into this app. I answer questions using the Bible, Ellen White's writings, commentary, and hymns already stored on your device — no internet needed once the AI model is downloaded, and I'll always show you exactly which source an answer came from.";

const GREETING_PHRASES = new Set([
  'hi', 'hey', 'hello', 'hiya', 'yo', 'howdy', 'greetings',
  'hi there', 'hey there', 'hello there',
  'good morning', 'good afternoon', 'good evening', 'morning', 'evening',
]);
const FAREWELL_PHRASES = new Set([
  'bye', 'goodbye', 'good bye', 'bye bye', 'see you', 'see ya', 'later',
  'take care', 'goodnight', 'good night', 'gotta go',
]);
const THANKS_PHRASES = new Set(['thanks', 'thank you', 'thanks a lot', 'thank you so much', 'ty', 'thx', 'appreciate it']);
const IDENTITY_PHRASES = new Set([
  'who are you', 'what are you', 'what is your name', "what's your name", 'your name',
  'tell me about yourself', 'introduce yourself', 'what can you do', 'what do you do',
  'are you an ai', 'are you a bot', 'are you a robot', 'are you human', 'are you real',
]);

// A closing prompt like ChatGPT/Gemini use, so a real answer doesn't just stop cold —
// appended in code (see askAssistant) rather than asked of the model itself, the same
// reasoning answerFromContext already uses for citations: a 1B model given one more
// compound instruction (answer AND remember to append a follow-up) tends to drop one or
// the other, where a deterministic append always works.
const FOLLOW_UP_PROMPTS = [
  'Did that answer your question?',
  'Want me to go deeper on any part of that?',
  'Do you have a follow-up question?',
  'Anything else you want to know?',
  'Would you like me to explain further?',
];

function randomFollowUp(): string {
  return FOLLOW_UP_PROMPTS[Math.floor(Math.random() * FOLLOW_UP_PROMPTS.length)];
}

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[!.?,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function quickReplyFor(question: string): string | null {
  const normalized = normalize(question);
  if (GREETING_PHRASES.has(normalized)) return GREETING_REPLY;
  if (FAREWELL_PHRASES.has(normalized)) return FAREWELL_REPLY;
  if (THANKS_PHRASES.has(normalized)) return THANKS_REPLY;
  if (IDENTITY_PHRASES.has(normalized)) return IDENTITY_REPLY;
  return null;
}

// A plain "look up a verse" ask doesn't need the model either — it's not a question to
// reason about, it's a direct row in the bible table. Only fires when the question is
// the reference plus incidental filler ("what does John 3:16 say", "show me Genesis
// 1:1"); anything with real question content beyond that (e.g. "what does John 3:16
// mean") still goes through search + the model, since that needs actual explanation.
const LOOKUP_FILLER_WORDS = new Set([
  'what', 'does', 'do', 'say', 'says', 'said', 'show', 'me', 'look', 'up', 'read',
  'give', 'tell', 'is', 'in', 'the', 'verse', 'text', 'of', 'please', 'can', 'you',
]);

function isDirectVerseLookup(question: string, refStart: number, refEnd: number): boolean {
  const remainder = (question.slice(0, refStart) + question.slice(refEnd))
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return remainder.every((w) => LOOKUP_FILLER_WORDS.has(w));
}

async function directVerseLookup(question: string, db: SQLiteDatabase): Promise<string | null> {
  const refs = findScriptureRefs(question);
  if (refs.length !== 1) return null; // ambiguous or a real question referencing multiple verses — let the model handle it
  const ref = refs[0];
  if (!isDirectVerseLookup(question, ref.start, ref.end)) return null;

  const translation = (await getKv(db, 'bible_translation')) || DEFAULT_TRANSLATION;
  const verses = await getVerseRange(db, translation, ref.book, ref.chapter, ref.verse, ref.verseEnd);
  if (!verses.length) return null; // reference doesn't exist (typo'd chapter/verse) — fall through to the real pipeline

  const label = ref.verseEnd ? `${ref.book} ${ref.chapter}:${ref.verse}-${ref.verseEnd}` : `${ref.book} ${ref.chapter}:${ref.verse}`;
  return `${label} (${translation})\n\n${verses.map((v) => v.text).join(' ')}\n\nWant me to explain this verse?`;
}

// "Which day is the Sabbath" is one of the most basic, most commonly asked questions this
// app's specific audience has, and retrieval can't be trusted to reliably surface the one
// or two best sources for it every time — a narrative EGW chapter that merely mentions "the
// Sabbath day" in passing can out-rank the actual doctrinal answer (Fundamental Belief #20)
// depending on what else is in the top-N results that question. Answered directly and
// deterministically instead, the same reasoning as the identity quick-replies above: a
// question this foundational deserves a guaranteed-correct answer, not a retrieval gamble.
const SABBATH_DAY_RE =
  /\b(which|what)\s+day\s+(is|does|was)?\s*(the\s+)?sabbath\b|\bwhen\s+is\s+(the\s+)?sabbath\b|\bis\s+(the\s+)?sabbath\s+(on\s+)?saturday\b|\bis\s+saturday\s+(the\s+)?sabbath\b/;

const SABBATH_DAY_REPLY =
  'The Sabbath is Saturday — the seventh day of the week, kept from Friday sunset to Saturday sunset. God rested on the seventh day at Creation (Genesis 2:1-3), and the fourth commandment sets that day apart for rest and worship (Exodus 20:8-11).';

const SABBATH_DAY_SOURCES: SearchChunk[] = [
  { source: 'belief', ref: '20', title: 'Fundamental Belief #20: The Sabbath', text: '' },
  { source: 'bible', ref: 'Genesis|2|2', title: 'Genesis 2:2', text: '' },
  { source: 'bible', ref: 'Exodus|20|8', title: 'Exodus 20:8', text: '' },
];

// "Give me a verse about health" is a request for the verses themselves, not an
// explanation of them — asking the model to answer it produces a paraphrase (or worse, a
// paraphrase that drifts from what the verses actually say) when what was wanted is the
// verses, verbatim, with their references. Detected by the request verb ("give me",
// "list", "show me", "find me", "what/which verses") UNLESS the question also asks for
// understanding ("explain", "meaning", "why", "how") — that combination still goes to the
// model, since that's a real request for explanation despite the "give me" framing.
const RAW_LIST_RE = /^(give|show|list|find)\b|\bwhat (are )?some\b|\bwhich verses?\b|\bwhat verses?\b/;
const EXPLAIN_OVERRIDE_RE = /\bexplain\b|\bmean(ing)?\b|\bwhy\b|\bhow (does|do|is|are|can)\b|\bunderstand\b/;

function wantsRawContent(question: string): boolean {
  const q = question.toLowerCase();
  if (EXPLAIN_OVERRIDE_RE.test(q)) return false;
  return RAW_LIST_RE.test(q);
}

// Bible rows are indexed one-per-verse (see buildSearchIndex), so a bible chunk's `text` is
// already the exact, complete verse — nothing to paraphrase. EGW/commentary chunks are
// paragraph-sized excerpts; quoting those verbatim is still more honest than a paraphrase
// for a request that explicitly didn't ask for one.
function formatRawChunks(chunks: SearchChunk[]): string {
  return chunks.map((c) => `${c.title}\n${c.text}`).join('\n\n');
}

export type AssistantCallbacks = {
  onToken?: (partialText: string) => void; // live text of whichever section is currently generating
  // fires once per finished section — push each as its own chat message. `sources` is the
  // retrieved chunks backing this whole answer (same set for every section of one question),
  // attached only to the last section so the UI shows one "Sources" row per answer, not one
  // per section.
  onSection?: (sectionText: string, sources?: SearchChunk[]) => void;
};

// Recent real Q&A turns (not greetings or direct verse lookups — those aren't the kind
// of thing a follow-up question refers back to), fed into the model as actual
// conversation history so "what about verse 17?" resolves against what was just
// discussed. Kept small: each extra turn adds prompt tokens on every question after it.
const MAX_HISTORY_TURNS = 2;
let conversationHistory: ConversationTurn[] = [];

// The UI calls this when the chat screen mounts, so leaving and reopening the AI tab
// starts a clean conversation — matching the visible chat log, which also resets on
// mount. Without this, the model would "remember" a conversation the screen no longer
// shows any trace of.
export function resetConversation(): void {
  conversationHistory = [];
}

// A long answer arrives as more than one call to onSection (see answerFromContext's
// continuation loop) rather than one long wait for a single giant reply — the caller
// treats each as a separate chat bubble.
export async function askAssistant(question: string, db: SQLiteDatabase, callbacks?: AssistantCallbacks): Promise<void> {
  const quickReply = quickReplyFor(question);
  if (quickReply) {
    callbacks?.onSection?.(quickReply);
    return;
  }
  if (SABBATH_DAY_RE.test(question.toLowerCase())) {
    callbacks?.onSection?.(SABBATH_DAY_REPLY, SABBATH_DAY_SOURCES);
    return;
  }
  const verseLookup = await directVerseLookup(question, db);
  if (verseLookup) {
    callbacks?.onSection?.(verseLookup);
    return;
  }

  await ensureSearchIndexBuilt(db);
  // A short follow-up ("what about verse 17?") often has little search signal of its
  // own — folding in the previous question's words gives keyword search something to
  // match even when the new question is mostly pronouns.
  const searchQuery = conversationHistory.length
    ? `${conversationHistory[conversationHistory.length - 1].question} ${question}`
    : question;

  // Raw-list requests are pure search + formatting — no reasoning or explanation needed,
  // so this doesn't touch the model at all (and works even before it's downloaded). Its own,
  // larger search (RAW_LIST_RESULT_LIMIT) is independent of the LLM path's tighter one below —
  // more excerpts here is free (a bigger SQL LIMIT), not the prefill cost it'd be for the model.
  if (wantsRawContent(question)) {
    const rawChunks = await searchContent(db, searchQuery, RAW_LIST_RESULT_LIMIT);
    if (!rawChunks.length) {
      callbacks?.onSection?.("I couldn't find anything matching that in the app's content — try rephrasing.");
      return;
    }
    const text = `${formatRawChunks(rawChunks)}\n\nWant me to explain any of these?`;
    callbacks?.onSection?.(text, rawChunks);
    conversationHistory.push({ question, answer: text });
    if (conversationHistory.length > MAX_HISTORY_TURNS) conversationHistory.shift();
    return;
  }

  const chunks = await searchContent(db, searchQuery, SEARCH_RESULT_LIMIT);

  if (!AI_INFERENCE_AVAILABLE) {
    callbacks?.onSection?.("AI answers aren't available in Expo Go. This needs a development build with the on-device model wired up.");
    return;
  }
  if (!hasModel()) {
    callbacks?.onSection?.('Download the AI model above first, then ask again.');
    return;
  }

  const rawSections: string[] = [];
  await answerFromContext(
    question,
    chunks,
    {
      onToken: callbacks?.onToken,
      onSection: (rawSectionText, isLast) => {
        // Belt-and-suspenders: the prompt now tells the model never to answer with just
        // citations or nothing at all, but a small model can still misbehave — this makes
        // sure the user is never shown a bare "Sources" list with no answer above it.
        const trimmed = rawSectionText.trim();
        const isFallback = !trimmed;
        const sectionText = trimmed || "I couldn't find a clear answer in the app's content for that — try rephrasing your question.";
        rawSections.push(sectionText);
        // The follow-up prompt is UI-only — it's never added to what's stored in
        // conversationHistory, so the model never sees (or has to react to) its own
        // randomized closing question on the next turn. Skipped on the fallback text
        // above, which already ends with its own prompt to rephrase.
        const displayText = isLast && !isFallback ? `${sectionText}\n\n${randomFollowUp()}` : sectionText;
        callbacks?.onSection?.(displayText, isLast && chunks.length ? chunks : undefined);
      },
    },
    conversationHistory
  );

  conversationHistory.push({ question, answer: rawSections.join(' ') });
  if (conversationHistory.length > MAX_HISTORY_TURNS) conversationHistory.shift();
}
