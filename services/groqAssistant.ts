import type { SearchChunk } from '@/database/searchIndex';
import type { ConversationTurn } from './llm';

// Read from .env (git-ignored — see .env.example for the variable name only, never the
// real value) via Expo's built-in EXPO_PUBLIC_* env var support, which inlines it into
// the JS bundle at build time. There is no backend here to proxy this call through, so
// this key ships inside the compiled app like any client-side secret does — it is not
// meaningfully hidden from someone who has the installed app, only from source control.
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Groq's current production Llama model — update here if Groq retires/renames it.
const GROQ_MODEL = 'llama-3.3-70b-versatile';
// Lower than the offline path's ceiling on purpose — Groq's own generation is already
// fast (LPU inference, hundreds of tokens/sec), so this isn't really a speed lever; it's
// a length lever, capping how long an answer is allowed to run on. Paired with the
// system prompt's "be concise" instruction, this keeps online answers snappy and to the
// point rather than the offline model's more padded, multi-paragraph style.
const MAX_RESPONSE_TOKENS = 450;

export const GROQ_AVAILABLE = !!GROQ_API_KEY;

// Online mode uses a much larger cloud model than the on-device ~1B one (see llm.ts), so
// unlike the offline prompt it's allowed to draw on the model's own broader knowledge of
// Scripture and Adventist teaching rather than being limited to the retrieved excerpts —
// but the scope restriction is the important part here: this assistant answers as a
// Seventh-day Adventist, on Bible/SDA topics, and nothing else.
const SYSTEM_PROMPT = `You are Hello C, a Seventh-day Adventist Bible study assistant inside the
AdventCompass app, running in online mode. You answer strictly as a Seventh-day Adventist would,
drawing on the Bible, Ellen G. White's writings, the SDA Bible Commentary, the church's 28
Fundamental Beliefs, and Seventh-day Adventist teaching generally.

You may be given numbered excerpts retrieved from this app's own Bible/EGW/commentary/Fundamental
Beliefs content, followed by a question. Use them as your primary grounding when they're relevant,
but — unlike a purely offline lookup — you may also draw on your own broader knowledge of
Scripture and Adventist teaching to give a complete, accurate answer, since you have far more of
that knowledge than a handful of excerpts can carry. Never contradict Seventh-day Adventist
doctrine (the seventh-day Sabbath as Saturday, the state of the dead, the heavenly sanctuary, the
soon Second Coming, and the rest of the 28 Fundamental Beliefs) even if other Christian traditions
teach otherwise — answer as a convinced, well-studied Adventist, not as a neutral summarizer of
"different views" across denominations.

STRICT SCOPE — this is the most important rule: only answer questions about the Bible, Christian
theology from a Seventh-day Adventist perspective, Ellen G. White's writings, SDA church history
and doctrine, or Seventh-day Adventist resources. If the question is about anything else — general
knowledge, current events, other software, personal advice unrelated to faith, coding, politics,
entertainment, medical/legal/financial advice, or another religion's teaching sought as neutral
information rather than in relation to Scripture — decline plainly and redirect: say this assistant
only answers Bible and Seventh-day Adventist questions, and invite them to ask one of those
instead. Do not partially answer the off-topic question and then add a disclaimer — decline
outright, before saying anything else.

Judge scope from the WHOLE conversation, not the isolated wording of the latest message alone.
Prior turns are included below as real conversation history — a short follow-up like "where is
that found?", "give me the proof", "why?", "are you sure?", or "what about verse 17?" almost
always continues whatever Bible/SDA topic was just being discussed, even though it repeats none
of the Bible/SDA keywords itself. Treat those as in-scope continuations by default; only decline
if the conversation as a whole has genuinely moved to an unrelated topic.

Separately: scope and confidence are different things. If a question IS in scope but you're
genuinely unsure of the answer, or don't know a specific fact (an exact reference, a date, a
detail), just say so plainly — "I'm not sure" / "I don't know that one for certain" — rather than
guessing, and never use the off-topic decline for a question that's actually in scope just because
you're uncertain of the specifics.

Answer the way a well-studied, trusted Bible teacher would — someone speaking with a person, not
an AI hedging through disclaimers. State things plainly: "Scripture teaches...", "The Sabbath
is...", not "some believe..." or "it could be argued...". Lead with a one-sentence direct answer,
then back it up with Scripture and, where relevant, Ellen White's writings or the Fundamental
Beliefs. Favor precision over length: a short, sharply accurate answer beats a long one — do not
pad, hedge, repeat yourself, or add extra background the question didn't ask for. Do not fabricate
Bible verses or quotations; if unsure of exact wording, describe the passage's content and cite the
reference rather than inventing a quotation.`;

type GroqChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

// Streamed via `stream: true` + Server-Sent Events rather than one plain awaited
// fetch — Groq's own generation is fast, but waiting for the ENTIRE response before
// showing anything (the previous version) meant the UI sat on a bare "thinking"
// bubble for the whole round-trip, which read as slow regardless of how fast Groq
// actually was. Streaming tokens in live, the same way the offline path already
// does via llm.ts's onToken callback, is what actually fixes the *perceived* speed.
//
// React Native's fetch doesn't reliably expose a readable stream body across
// platforms in this Expo/RN version, so this uses XMLHttpRequest instead — its
// `responseText` grows incrementally as data arrives and `onprogress` fires on each
// chunk, which is the standard, dependency-free way to consume SSE in React Native.
export function answerOnlineFromContext(
  question: string,
  chunks: SearchChunk[],
  history: ConversationTurn[] = [],
  onToken?: (partialText: string) => void
): Promise<string> {
  if (!GROQ_API_KEY) return Promise.reject(new Error('Online AI is not configured (missing API key).'));

  const excerpts = chunks.map((c, i) => `[${i + 1}] (${c.title}) ${c.text}`).join('\n\n');
  const basePrompt = chunks.length
    ? `Excerpts from this app's content:\n${excerpts}\n\nQuestion: ${question}`
    : `Question: ${question}`;

  const messages: GroqChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.flatMap((turn): GroqChatMessage[] => [
      { role: 'user', content: turn.question },
      { role: 'assistant', content: turn.answer },
    ]),
    { role: 'user', content: basePrompt },
  ];

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', GROQ_API_URL);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${GROQ_API_KEY}`);

    let accumulated = '';
    let processedLength = 0;
    // Holds whatever's left after the last complete "\n" — an SSE line can arrive
    // split across two progress events, so only fully-terminated lines get parsed;
    // any trailing partial line is carried forward to be completed by the next chunk.
    let lineBuffer = '';

    xhr.onprogress = () => {
      const newText = xhr.responseText.slice(processedLength);
      processedLength = xhr.responseText.length;
      lineBuffer += newText;
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const delta = json?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta) {
            accumulated += delta;
            onToken?.(accumulated);
          }
        } catch {
          // Malformed/unexpected line shape — skip it rather than fail the whole
          // stream over one bad chunk.
        }
      }
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Groq API error ${xhr.status}: ${xhr.responseText.slice(0, 300)}`));
        return;
      }
      const trimmed = accumulated.trim();
      if (!trimmed) {
        reject(new Error('Groq API returned an empty response.'));
        return;
      }
      resolve(trimmed);
    };

    xhr.onerror = () => reject(new Error('Network request failed'));
    xhr.ontimeout = () => reject(new Error('Request timed out'));

    xhr.send(
      JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: MAX_RESPONSE_TOKENS,
        stream: true,
      })
    );
  });
}

// Raw errors here are either a fetch-level network exception or our own thrown Error
// wrapping Groq's HTTP status — neither is meaningful to someone who isn't a developer.
export function describeGroqError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (/unable to resolve host|no address associated|enotfound|network request failed|network is unreachable|failed to fetch/.test(lower)) {
    return 'No internet connection. Online mode needs a network connection — switch to offline mode or check your connection.';
  }
  if (/\b401\b|invalid api key|unauthorized/.test(lower)) {
    return "The online AI isn't configured correctly (invalid API key). Try offline mode instead.";
  }
  if (/\b429\b|rate limit/.test(lower)) {
    return 'Online AI is temporarily rate-limited. Try again in a moment, or switch to offline mode.';
  }
  if (/timed? ?out/.test(lower)) {
    return 'The request timed out. Check your connection and try again.';
  }
  return "Couldn't reach the online AI right now. Try again, or switch to offline mode.";
}
