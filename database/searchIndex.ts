import type { SQLiteDatabase } from 'expo-sqlite';
import { getKv, setKv } from './kv';
import { EGW_BOOK_LIST, getEgwBook, clearEgwCache } from './egwBooks';
import { COMMENTARY_VOLUMES, getCommentaryVolume, clearCommentaryCache } from './sdaCommentary';
import { HYMNALS, getHymns, clearHymnCache } from './hymnal';
import { DEVOTIONALS } from './devotionals';

export type SearchChunk = { text: string; source: string; ref: string; title: string };

const INDEX_BUILT_KEY = 'search_index_built_v4';
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
      const book = getEgwBook(code);
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
    clearEgwCache();

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
  ['sick', 'sickness', 'illness', 'ill', 'disease', 'healing', 'heal'],
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
  ['rest', 'resting', 'sabbath'],
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

function toMatchQuery(question: string): string | null {
  const terms = question
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((w) => w.length > 2 && !STOPWORDS.has(w));
  if (!terms || !terms.length) return null;

  const expanded = new Set<string>();
  for (const term of terms) {
    expanded.add(term);
    for (const synonym of SYNONYM_LOOKUP.get(term) ?? []) expanded.add(synonym);
  }
  return [...expanded].map((t) => `"${t}"`).join(' OR ');
}

// When a question names which kind of source it wants — "which BIBLE VERSE talks about
// health", "what does ELLEN WHITE say", "the COMMENTARY on this" — keyword search alone
// has no notion of that; it just returns whatever matches best across every source, which
// is how asking for a Bible verse can come back with an EGW paraphrase instead. Detecting
// that intent and filtering to the named source directly fixes it.
function detectSourceIntent(question: string): string | null {
  const q = question.toLowerCase();
  if (/\bbible verses?\b|\bverses? in the bible\b|\bscriptures?\b|\bwhat verse\b|\bwhich verse\b|\bthe bible\b|\bin the bible\b/.test(q)) return 'bible';
  if (/\begw\b|ellen (g\.? ?)?white|spirit of prophecy/.test(q)) return 'egw';
  if (/\bcommentary\b/.test(q)) return 'commentary';
  return null;
}

// The AI Assistant answers only from Bible, EGW, and commentary — hymnal and devotional
// content is excluded outright (not just penalized) rather than reindexed away, since
// hymns/devotionals repeatedly produced shallow or off-topic answers (a hymn mentioning
// "Jesus" in a lyric line is not an explanation of anything). They stay in the index —
// removing them would mean another full reindex for no real benefit — this clause just
// makes sure the AI assistant never sees them, ever.
const AI_SOURCES = `('bible', 'egw', 'commentary')`;

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
export async function searchContent(db: SQLiteDatabase, question: string, limit = 6): Promise<SearchChunk[]> {
  const match = toMatchQuery(question);
  if (!match) return [];

  const sourceIntent = detectSourceIntent(question);
  if (sourceIntent) {
    const filtered = await db.getAllAsync<SearchChunk>(
      `SELECT text, source, ref, title FROM content_search
       WHERE content_search MATCH ? AND source = ?
       ORDER BY bm25(content_search, 1.0, 0.0, 0.0, 3.0)
       LIMIT ?`,
      match,
      sourceIntent,
      limit
    );
    // Only trust the filter if it actually found something — if the requested source has
    // no match at all, falling through to the normal search beats telling the user "not
    // covered" when a good answer exists in another source.
    if (filtered.length) return filtered;
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
