import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { SQLiteDatabase } from 'expo-sqlite';
import { hasModel } from './aiModel';
import { answerFromContext, ConversationTurn } from './llm';
import { ensureSearchIndexBuilt, searchContent } from '@/database/searchIndex';
import { getVerseRange } from '@/database/bible';
import { findScriptureRefs } from '@/database/scriptureRefs';
import { getKv } from '@/database/kv';
import { DEFAULT_TRANSLATION } from '@/database/translations';

// llama.rn is a native module — Expo Go (StoreClient) can never load it, only a
// development build can. Same check services/notifications.ts uses for its own
// native-module feature.
export const AI_INFERENCE_AVAILABLE = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

export type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string };

// Fewer excerpts means a shorter prompt, which means less time spent on prefill before
// the first token even starts streaming — 2 is still enough context for most questions,
// and the source-rank penalty above now keeps low-value matches (hymns) from crowding
// out the two that actually matter.
const SEARCH_RESULT_LIMIT = 2;

// Small talk doesn't need the model spun up at all — matched and answered instantly,
// which also means these work even before the AI model has been downloaded. Only exact
// (normalized) matches trigger this; "hi, what does the bible say about hope" still goes
// through the real pipeline since there's an actual question attached.
const GREETING_REPLY =
  "Hi, I'm Hello C, your offline Bible study assistant. Ask me anything about the Bible, Ellen White's writings, commentary, or hymns already in the app, and I'll answer from what's here and show you exactly where it came from.";
const FAREWELL_REPLY = 'Goodbye! Come back anytime you have a question.';
const THANKS_REPLY = "You're welcome! Let me know if you have another question.";

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
  return `${label} (${translation})\n\n${verses.map((v) => v.text).join(' ')}`;
}

export type AssistantCallbacks = {
  onToken?: (partialText: string) => void; // live text of whichever section is currently generating
  onSection?: (sectionText: string) => void; // fires once per finished section — push each as its own chat message
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
  const verseLookup = await directVerseLookup(question, db);
  if (verseLookup) {
    callbacks?.onSection?.(verseLookup);
    return;
  }
  if (!AI_INFERENCE_AVAILABLE) {
    callbacks?.onSection?.("AI answers aren't available in Expo Go. This needs a development build with the on-device model wired up.");
    return;
  }
  if (!hasModel()) {
    callbacks?.onSection?.('Download the AI model above first, then ask again.');
    return;
  }

  await ensureSearchIndexBuilt(db);
  // A short follow-up ("what about verse 17?") often has little search signal of its
  // own — folding in the previous question's words gives keyword search something to
  // match even when the new question is mostly pronouns.
  const searchQuery = conversationHistory.length
    ? `${conversationHistory[conversationHistory.length - 1].question} ${question}`
    : question;
  const chunks = await searchContent(db, searchQuery, SEARCH_RESULT_LIMIT);
  const sourcesFooter = chunks.length ? `Sources:\n${chunks.map((c, i) => `[${i + 1}] ${c.title}`).join('\n')}` : '';

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
        const sectionText = rawSectionText.trim() || "I couldn't find a clear answer in the app's content for that — try rephrasing your question.";
        rawSections.push(sectionText);
        const text = isLast && sourcesFooter ? `${sectionText}\n\n${sourcesFooter}` : sectionText;
        callbacks?.onSection?.(text);
      },
    },
    conversationHistory
  );

  conversationHistory.push({ question, answer: rawSections.join(' ') });
  if (conversationHistory.length > MAX_HISTORY_TURNS) conversationHistory.shift();
}
