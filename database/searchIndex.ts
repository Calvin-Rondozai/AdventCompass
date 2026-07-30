import type { SQLiteDatabase } from 'expo-sqlite';
import { getKv, setKv } from './kv';
import { EGW_BOOK_LIST, getEgwBook } from './egwBooks';
import { COMMENTARY_VOLUMES, getCommentaryVolume, clearCommentaryCache } from './sdaCommentary';
import { HYMNALS, getHymns, clearHymnCache } from './hymnal';
import { DEVOTIONALS } from './devotionals';
import { getFundamentalBeliefs } from './fundamentalBeliefs';

export type SearchChunk = { text: string; source: string; ref: string; title: string };

// A source's `ref` is a pipe-delimited string whose shape depends on which of the four
// insert sites in buildSearchIndex below produced it (see the Row literals there) — this
// is the single place that knows how to turn one back into an in-app route, so the AI
// Assistant's "Sources" chips can be tappable instead of plain text. Returns null for a
// source type with no reader screen of its own (hymnal/devotional are excluded from
// AI_SOURCES anyway, so in practice this only ever sees bible/egw/commentary/belief).
// Literal pathnames (not a generic `string`) so this satisfies expo-router's typed-routes
// Href type at the call site without a cast.
export type SourceLink =
  | { pathname: '/bible/[book]/[chapter]'; params: { book: string; chapter: string; verse: string } }
  | { pathname: '/more/egw/[code]/[number]'; params: { code: string; number: string } }
  | { pathname: '/more/commentary/[book]/[chapter]'; params: { book: string; chapter: string } }
  | { pathname: '/more/beliefs/[number]'; params: { number: string } };

export function resolveSourceLink(chunk: Pick<SearchChunk, 'source' | 'ref'>): SourceLink | null {
  const parts = chunk.ref.split('|');
  switch (chunk.source) {
    case 'bible': {
      const [book, chapter, verse] = parts;
      if (!book || !chapter || !verse) return null;
      return { pathname: '/bible/[book]/[chapter]', params: { book, chapter, verse } };
    }
    case 'egw': {
      const [code, number] = parts;
      if (!code || !number) return null;
      return { pathname: '/more/egw/[code]/[number]', params: { code, number } };
    }
    case 'commentary': {
      const [book, chapter] = parts;
      if (!book || !chapter) return null;
      return { pathname: '/more/commentary/[book]/[chapter]', params: { book, chapter } };
    }
    case 'belief': {
      const [number] = parts;
      if (!number) return null;
      return { pathname: '/more/beliefs/[number]', params: { number } };
    }
    default:
      return null;
  }
}

// Bumped to v5: adds the 28 Fundamental Beliefs (see buildSearchIndex) to the index — each
// one is the official, proof-texted SDA doctrinal statement on its topic (e.g. Belief #20,
// "The Sabbath", cites Gen. 2:1-3, Exod. 20:8-11 etc.), exactly the kind of authoritative,
// already-in-the-app content that answers "what does this app teach about X" questions
// better than a paraphrase assembled from scattered verse/commentary excerpts. An install
// that already built a v4 index needs this rebuild to pick the new rows up at all.
const INDEX_BUILT_KEY = 'search_index_built_v5';
const INSERT_BATCH_SIZE = 400;
const MIN_PARAGRAPH_LENGTH = 40;
// Kept short — these get concatenated into the LLM prompt at answer time, and a
// shorter prompt means less prefill time before the first token streams back.
const MAX_CHUNK_LENGTH = 400;

type Row = [text: string, source: string, ref: string, title: string];

async function flush(db: SQLiteDatabase, rows: Row[]): Promise<void> {
  if (!rows.length) return;
  const placeholders = rows.map(() => '(?,?,?,?)').join(',');
  await db.runAsync(`INSERT INTO content_search (text, source, ref, title) VALUES ${placeholders}`, rows.flat());
}

async function insertBatched(db: SQLiteDatabase, rows: Row[], buffer: Row[]): Promise<void> {
  buffer.push(...rows);
  while (buffer.length >= INSERT_BATCH_SIZE) {
    await flush(db, buffer.splice(0, INSERT_BATCH_SIZE));
  }
}

// Splits on paragraph breaks first, then hard-wraps anything still too long — keeps
// each indexed row focused enough for FTS matching and the LLM's context window without
// cutting mid-sentence any more than necessary.
function chunkText(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length >= MIN_PARAGRAPH_LENGTH);
  const chunks: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= MAX_CHUNK_LENGTH) {
      chunks.push(p);
      continue;
    }
    for (let i = 0; i < p.length; i += MAX_CHUNK_LENGTH) {
      chunks.push(p.slice(i, i + MAX_CHUNK_LENGTH));
    }
  }
  return chunks;
}

// Builds the AI Assistant's full-text index once, ever, the first time it's needed —
// most installs never open the AI tab, so this cost (parsing every EGW book and
// commentary volume) doesn't belong in the app's normal startup migration path.
//
// This is called from two places that can race: the chat screen kicks it off proactively
// as soon as the model's ready, and askAssistant() also calls it defensively before every
// question in case that background build hasn't happened yet (or is still running). If a
// question comes in while the first build is mid-flight, both calls saw the "not built
// yet" KV flag and would each try to open their own db.withTransactionAsync — SQLite
// can't nest transactions, and the second one fails with "cannot start a transaction
// within a transaction". Caching the in-flight promise means a concurrent call just
// awaits the same build instead of starting a second one.
let indexingPromise: Promise<void> | null = null;

export function ensureSearchIndexBuilt(db: SQLiteDatabase, onProgress?: (label: string) => void): Promise<void> {
  if (indexingPromise) return indexingPromise;
  indexingPromise = buildSearchIndex(db, onProgress).finally(() => {
    indexingPromise = null;
  });
  return indexingPromise;
}

async function buildSearchIndex(db: SQLiteDatabase, onProgress?: (label: string) => void): Promise<void> {
  if ((await getKv(db, INDEX_BUILT_KEY)) === '1') return;

  const buffer: Row[] = [];

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM content_search');

    onProgress?.('Bible');
    const verses = await db.getAllAsync<{ book: string; chapter: number; verse: number; text: string }>(
      "SELECT book, chapter, verse, text FROM bible WHERE translation = 'NHEB'"
    );
    await insertBatched(
      db,
      verses.map((v): Row => [v.text, 'bible', `${v.book}|${v.chapter}|${v.verse}`, `${v.book} ${v.chapter}:${v.verse}`]),
      buffer
    );

    for (let i = 0; i < EGW_BOOK_LIST.length; i++) {
      const { code, title } = EGW_BOOK_LIST[i];
      onProgress?.(`${title} (${i + 1}/${EGW_BOOK_LIST.length})`);
      const book = await getEgwBook(db, code);
      if (!book) continue;
      for (const chapter of book.chapters) {
        const rows: Row[] = chunkText(chapter.content).map((chunk, idx) => [
          chunk,
          'egw',
          `${code}|${chapter.number}|${idx}`,
          `${title}: ${chapter.title}`,
        ]);
        await insertBatched(db, rows, buffer);
      }
    }

    for (const { code, title } of COMMENTARY_VOLUMES) {
      onProgress?.(title);
      const volume = getCommentaryVolume(code);
      if (!volume) continue;
      for (const book of volume.books) {
        for (const chapter of book.chapters) {
          const rows: Row[] = chapter.entries.map((entry): Row => [
            entry.content,
            'commentary',
            `${book.name}|${chapter.number}|${entry.verseStart}-${entry.verseEnd}`,
            `${book.name} ${chapter.number}:${entry.verseStart}${entry.verseEnd !== entry.verseStart ? `-${entry.verseEnd}` : ''} commentary`,
          ]);
          await insertBatched(db, rows, buffer);
        }
      }
    }
    clearCommentaryCache();

    for (const { code, label, source } of HYMNALS) {
      onProgress?.(`${label} hymnal`);
      const hymns = getHymns(code);
      const rows: Row[] = hymns.map((h): Row => [h.lyrics, 'hymnal', `${code}|${h.number}`, `${h.title} (${source} #${h.number})`]);
      await insertBatched(db, rows, buffer);
    }
    clearHymnCache();

    onProgress?.('Devotionals');
    await insertBatched(
      db,
      DEVOTIONALS.map((d): Row => [`${d.body} ${d.reflection}`, 'devotional', d.reference, d.title]),
      buffer
    );

    onProgress?.('Fundamental Beliefs');
    await insertBatched(
      db,
      getFundamentalBeliefs().map((b): Row => [b.content, 'belief', String(b.number), `Fundamental Belief #${b.number}: ${b.title}`]),
      buffer
    );

    await flush(db, buffer);
  });

  await setKv(db, INDEX_BUILT_KEY, '1');
}

// Turns a free-text question into an FTS5 MATCH expression: strip to words, drop
// filler words, quote each term (so punctuation like apostrophes can't be read as FTS5
// operator syntax) and OR them together — bm25 ranking on the query does the real
// relevance work, this just decides what counts as a candidate row at all.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'what', 'does', 'do', 'did', 'to', 'of', 'in', 'on',
  'and', 'or', 'for', 'about', 'that', 'this', 'it', 'how', 'why', 'who', 'i', 'me', 'my', 'can', 'you',
  // Request-framing words ("GIVE me a BIBLE VERSE that TALKS about health") — every row in
  // this index already IS Bible/EGW/commentary content, so "bible" and "verse" carry no
  // topical signal at all here and only dilute the match; "give"/"talk(s)"/"tell"/"show"
  // are so common across scripture that they were winning bm25 ranking over the one word
  // that actually named the topic, surfacing something that shared "give" or "talking"
  // (e.g. Ephesians 5:4's "foolish talking... giving of thanks") instead of the real subject.
  'give', 'gives', 'giving', 'bible', 'verse', 'verses', 'talk', 'talks', 'talking', 'tell',
  'tells', 'show', 'shows', 'find', 'please', 'want', 'need', 'know', 'some', 'any',
]);

// Porter stemming (in the FTS5 tokenizer) already collapses word *forms* — "believe" /
// "believing" / "belief" — but not different words for the same idea. A question asking
// about "worry" won't match a devotional that only says "anxious" without this. Full
// semantic search would need embedding the entire ~100k-row index, which is hours of
// on-device inference and gigabytes of vectors — not viable on a phone. This is the
// cheap, static alternative: widen the query with common synonyms for the same concepts.
const SYNONYM_GROUPS: string[][] = [
  ['jesus', 'christ', 'messiah', 'saviour', 'savior'],
  ['god', 'lord', 'father', 'creator', 'almighty'],
  ['spirit', 'comforter'],
  ['commandment', 'commandments', 'law', 'decalogue'],
  ['sanctuary', 'tabernacle', 'temple'],
  ['prophecy', 'prophetic', 'prophet', 'prophesy'],
  ['baptism', 'baptize', 'baptized', 'baptizing'],
  ['righteousness', 'righteous', 'justified', 'justification'],
  ['resurrection', 'resurrected', 'risen'],
  ['satan', 'devil', 'lucifer'],
  ['church', 'congregation'],
  ['tithe', 'tithing', 'offering', 'offerings'],
  ['worry', 'worried', 'worrying', 'anxious', 'anxiety', 'stress', 'stressed'],
  ['afraid', 'fear', 'scared', 'frightened', 'terrified'],
  ['sad', 'sadness', 'sorrow', 'sorrowful', 'grief', 'grieving', 'mourning'],
  ['angry', 'anger', 'wrath', 'rage', 'furious'],
  ['death', 'dying', 'die', 'mortality', 'dead'],
  ['sick', 'sickness', 'illness', 'ill', 'disease', 'healing', 'heal', 'health', 'healthy'],
  ['poor', 'poverty', 'needy'],
  ['rich', 'wealth', 'wealthy', 'riches'],
  ['forgive', 'forgiveness', 'forgiving', 'mercy', 'pardon'],
  ['love', 'loving', 'beloved', 'affection'],
  ['hope', 'hopeful', 'hopeless'],
  ['strength', 'strong', 'strengthen', 'power'],
  ['weak', 'weakness', 'weary', 'tired', 'exhausted'],
  ['marriage', 'married', 'spouse', 'husband', 'wife'],
  ['children', 'child', 'kids', 'parenting', 'parent'],
  ['work', 'working', 'labor', 'job'],
  ['rest', 'resting', 'sabbath', 'saturday'],
  ['prayer', 'praying', 'pray'],
  ['faith', 'believe', 'belief', 'trust', 'trusting'],
  ['doubt', 'doubting', 'unbelief'],
  ['temptation', 'tempted', 'tempt'],
  ['guilt', 'guilty', 'shame', 'ashamed'],
  ['peace', 'peaceful', 'calm'],
  ['joy', 'joyful', 'happiness', 'happy'],
  ['patience', 'patient', 'endurance', 'perseverance'],
  ['wisdom', 'wise', 'understanding'],
  ['judgment', 'judgement', 'judging'],
  ['heaven', 'eternity', 'eternal'],
  ['salvation', 'saved', 'redemption', 'redeemed'],
  ['sin', 'sinful', 'sinning', 'wrongdoing'],
  ['loneliness', 'lonely', 'alone', 'isolation'],
];

const SYNONYM_LOOKUP = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const word of group) SYNONYM_LOOKUP.set(word, group);
}

function questionTerms(question: string): string[] {
  return (
    question
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((w) => w.length > 2 && !STOPWORDS.has(w)) ?? []
  );
}

// Every original term OR'd together with all its synonyms — a wide net that guarantees
// *something* usually comes back, but a chunk only needs to share ONE of these (often after
// synonym expansion loosens it further) to qualify as a candidate. That looseness is exactly
// what let a barely-related excerpt outrank something genuinely on-topic often enough to make
// answers feel off-target — this is now only the fallback; see toStrictMatchQuery below.
function toMatchQuery(question: string): string | null {
  const terms = questionTerms(question);
  if (!terms.length) return null;

  const expanded = new Set<string>();
  for (const term of terms) {
    expanded.add(term);
    for (const synonym of SYNONYM_LOOKUP.get(term) ?? []) expanded.add(synonym);
  }
  return [...expanded].map((t) => `"${t}"`).join(' OR ');
}

// FTS5 space-separates terms as implicit AND — every one of the question's own words (no
// synonym expansion) must appear in a row for it to match at all. Much tighter than the OR
// query above, so when the question has enough specific words to narrow things down, this
// surfaces excerpts that are actually about all of what was asked, not just one word of it.
// Tried first; searchContent only falls back to the loose OR query if this finds nothing.
function toStrictMatchQuery(question: string): string | null {
  const terms = [...new Set(questionTerms(question))];
  if (!terms.length) return null;
  return terms.map((t) => `"${t}"`).join(' ');
}

// When a question names which kind of source it wants — "which BIBLE VERSE talks about
// health", "what does ELLEN WHITE say", "the COMMENTARY on this" — keyword search alone
// has no notion of that; it just returns whatever matches best across every source, which
// is how asking for a Bible verse can come back with an EGW paraphrase instead. Detecting
// that intent and filtering to the named source directly fixes it.
function detectSourceIntent(question: string): string | null {
  const q = question.toLowerCase();
  if (/\bbible verses?\b|\bverses? in the bible\b|\bscriptures?\b|\bwhat verse\b|\bwhich verse\b|\bthe bible\b|\bin the bible\b/.test(q)) return 'bible';
  // "White" alone is deliberately included — this app's whole context is Bible study, and
  // that's how people actually refer to her ("what does White say", "Mrs White wrote...").
  // The rare false-positive (a genuine Bible question that happens to mention "white", e.g.
  // Revelation's white robes) still self-corrects: searchContent only trusts this filter if
  // it actually finds something, otherwise it falls through to the unfiltered search.
  if (/\begw\b|ellen (g\.? ?)?white|mrs\.? white|\bwhite\b|spirit of prophecy/.test(q)) return 'egw';
  if (/\bcommentary\b/.test(q)) return 'commentary';
  if (/fundamental belief|\bdoctrine\b|\bofficially believe\b|does (the church|adventists?) (teach|believe)/.test(q)) return 'belief';
  return null;
}

// The AI Assistant answers only from Bible, EGW, commentary, and the 28 Fundamental
// Beliefs — hymnal and devotional content is excluded outright (not just penalized) rather
// than reindexed away, since hymns/devotionals repeatedly produced shallow or off-topic
// answers (a hymn mentioning "Jesus" in a lyric line is not an explanation of anything).
// They stay in the index — removing them would mean another full reindex for no real
// benefit — this clause just makes sure the AI assistant never sees them, ever.
const AI_SOURCES = `('bible', 'egw', 'commentary', 'belief')`;

// bm25() in SQLite FTS5 is negative, more-negative = better match, and it length-
// normalizes — so a short document where the query term appears prominently can outrank
// a long, substantive chapter that actually explains something, especially once
// "who"/"was"/"what" etc. get stripped as stopwords and a broad question reduces to a
// single common word.
//
// bm25(content_search, ...) takes one weight per column in declaration order
// (text, source, ref, title) — source/ref are UNINDEXED so their weight is moot, but the
// positional arguments are still required. title gets 3x text's weight: a chapter/entry
// whose *title* is thematically on-point (title is now indexed, not UNINDEXED — see
// schema.ts) is a much stronger relevance signal than the same word appearing once in a
// few hundred characters of body text, which is exactly the gap that let a Bible verse
// mentioning "Jesus" in passing outrank content actually about him.
async function runSearch(db: SQLiteDatabase, match: string, limit: number, source?: string): Promise<SearchChunk[]> {
  if (source) {
    return db.getAllAsync<SearchChunk>(
      `SELECT text, source, ref, title FROM content_search
       WHERE content_search MATCH ? AND source = ?
       ORDER BY bm25(content_search, 1.0, 0.0, 0.0, 3.0)
       LIMIT ?`,
      match,
      source,
      limit
    );
  }
  return db.getAllAsync<SearchChunk>(
    `SELECT text, source, ref, title FROM content_search
     WHERE content_search MATCH ? AND source IN ${AI_SOURCES}
     ORDER BY bm25(content_search, 1.0, 0.0, 0.0, 3.0)
     LIMIT ?`,
    match,
    limit
  );
}

export async function searchContent(db: SQLiteDatabase, question: string, limit = 6): Promise<SearchChunk[]> {
  const looseMatch = toMatchQuery(question);
  if (!looseMatch) return [];
  const strictMatch = toStrictMatchQuery(question);

  const sourceIntent = detectSourceIntent(question);
  if (sourceIntent) {
    // Strict (every original word required) first — only fall back to the synonym-expanded
    // OR query, then to no source filter at all, if a stricter attempt found nothing. Each
    // fallback trades precision for recall, tried in that order.
    if (strictMatch) {
      const strict = await runSearch(db, strictMatch, limit, sourceIntent);
      if (strict.length) return strict;
    }
    const filtered = await runSearch(db, looseMatch, limit, sourceIntent);
    // Only trust the filter if it actually found something — if the requested source has
    // no match at all, falling through to the normal search beats telling the user "not
    // covered" when a good answer exists in another source.
    if (filtered.length) return filtered;
  }

  if (strictMatch) {
    const strict = await runSearch(db, strictMatch, limit);
    if (strict.length) return strict;
  }
  return runSearch(db, looseMatch, limit);
}
