import type { SQLiteDatabase } from 'expo-sqlite';
import type { ReadingPlan } from './readingPlans';

export type Verse = { id: number; translation: string; book: string; chapter: number; verse: number; text: string };

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start;
  return Math.floor(diff / 86_400_000);
}

// A plain `dayOfYear % count` offset increments by 1 each day, so consecutive days
// landed on consecutive verses in id order — it just walked straight through Genesis.
// Knuth's multiplicative hash scatters sequential day-seeds across the whole range so
// the daily verse actually looks random, while staying deterministic (same verse for
// everyone on a given day, stable if you reopen the app later that day).
function scatter(seed: number, count: number): number {
  return (Math.imul(seed, 2654435761) >>> 0) % count;
}

export async function getVerseOfDay(
  db: SQLiteDatabase,
  translation: string,
  date: Date = new Date()
): Promise<Verse | null> {
  const { count } = (await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM bible WHERE translation = ?',
    translation
  )) ?? { count: 0 };
  if (count === 0) return null;
  const seed = date.getUTCFullYear() * 400 + dayOfYear(date);
  const offset = scatter(seed, count);
  return db.getFirstAsync<Verse>(
    'SELECT * FROM bible WHERE translation = ? ORDER BY id LIMIT 1 OFFSET ?',
    translation,
    offset
  );
}

// Same daily-pick approach as getVerseOfDay above, but scoped to a reading plan's own
// books/chapters — used when the user has chosen a plan as their daily-verse source
// instead of the whole Bible. Deterministic per day/plan, same as the whole-Bible pick.
export async function getVerseFromPlan(
  db: SQLiteDatabase,
  translation: string,
  plan: ReadingPlan,
  date: Date = new Date()
): Promise<Verse | null> {
  if (!plan.days.length) return null;
  const seed = date.getUTCFullYear() * 400 + dayOfYear(date);
  const day = plan.days[scatter(seed, plan.days.length)];
  if (!day.chapters.length) return null;
  const chapter = day.chapters[scatter(seed + 1, day.chapters.length)];

  const { count } = (await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM bible WHERE translation = ? AND book = ? AND chapter = ?',
    translation,
    day.book,
    chapter
  )) ?? { count: 0 };
  if (count === 0) return null;
  const offset = scatter(seed + 2, count);
  return db.getFirstAsync<Verse>(
    'SELECT * FROM bible WHERE translation = ? AND book = ? AND chapter = ? ORDER BY verse LIMIT 1 OFFSET ?',
    translation,
    day.book,
    chapter,
    offset
  );
}

// A small LRU-ish cache so re-visiting a chapter (swiping back and forth, returning to
// "Continue Reading") skips the SQLite round-trip entirely. Capped so it can't grow
// unbounded over a long session; eviction is just "oldest inserted" rather than true
// least-recently-used, which is plenty for how few chapters are open at once.
const CHAPTER_CACHE = new Map<string, Verse[]>();
const CHAPTER_CACHE_MAX = 30;

export async function getChapterVerses(
  db: SQLiteDatabase,
  translation: string,
  book: string,
  chapter: number
): Promise<Verse[]> {
  const key = `${translation}|${book}|${chapter}`;
  const cached = CHAPTER_CACHE.get(key);
  if (cached) return cached;

  const rows = await db.getAllAsync<Verse>(
    'SELECT * FROM bible WHERE translation = ? AND book = ? AND chapter = ? ORDER BY verse',
    translation,
    book,
    chapter
  );
  if (CHAPTER_CACHE.size >= CHAPTER_CACHE_MAX) {
    const oldestKey = CHAPTER_CACHE.keys().next().value;
    if (oldestKey !== undefined) CHAPTER_CACHE.delete(oldestKey);
  }
  CHAPTER_CACHE.set(key, rows);
  return rows;
}

// Lightweight COUNT(*) rather than reusing getChapterVerses — the VERSE-picker grid only
// needs a number, and shouldn't pull (and cache) full verse text just to size a grid.
export async function getChapterVerseCount(
  db: SQLiteDatabase,
  translation: string,
  book: string,
  chapter: number
): Promise<number> {
  const { count } = (await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM bible WHERE translation = ? AND book = ? AND chapter = ?',
    translation,
    book,
    chapter
  )) ?? { count: 0 };
  return count;
}

export async function getVerseRange(
  db: SQLiteDatabase,
  translation: string,
  book: string,
  chapter: number,
  verseStart: number,
  verseEnd?: number
): Promise<Verse[]> {
  return db.getAllAsync<Verse>(
    'SELECT * FROM bible WHERE translation = ? AND book = ? AND chapter = ? AND verse >= ? AND verse <= ? ORDER BY verse',
    translation,
    book,
    chapter,
    verseStart,
    verseEnd ?? verseStart
  );
}

export async function searchVerses(
  db: SQLiteDatabase,
  translation: string,
  query: string,
  limit = 50
): Promise<Verse[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  return db.getAllAsync<Verse>(
    'SELECT * FROM bible WHERE translation = ? AND text LIKE ? ORDER BY id LIMIT ?',
    translation,
    `%${trimmed}%`,
    limit
  );
}
