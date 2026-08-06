import { BIBLE_BOOKS } from './bibleBooks';

export type ChapterADayEntry = { book: string; chapter: number };

// The official 2026 "Bible Readings" one-chapter-a-day calendar from Revival &
// Reformation's Believe His Prophets program (https://www.revivalandreformation.org/bhp,
// schedule PDF: cdn.ministerialassociation.org/cdn/believe-his-prophets/2026 R&R Bible
// Reading Plan A4.pdf). Every day in that plan reads the next sequential chapter of
// whichever book it's currently on, so the whole 365-day calendar compresses into
// contiguous runs: {book, the chapter read on the run's first day, that day's 0-indexed
// day-of-year, how many days the run spans}. `startDay` is 0 = Jan 1.
//
// This is year-specific — Believe His Prophets publishes a new day-by-day calendar every
// year as part of its 5-year read-through. Only 2026 is encoded here; getChapterADay
// falls back to the old canonical-cycle algorithm for any other year until a future
// year's schedule is added below.
const BHP_2026_RUNS: { book: string; startChapter: number; startDay: number; days: number }[] = [
  { book: '1 Samuel', startChapter: 24, startDay: 0, days: 8 }, // Jan 1–8
  { book: '2 Samuel', startChapter: 1, startDay: 8, days: 23 }, // Jan 9–31
  { book: '2 Samuel', startChapter: 24, startDay: 31, days: 1 }, // Feb 1
  { book: '1 Kings', startChapter: 1, startDay: 32, days: 22 }, // Feb 2–23
  { book: '2 Kings', startChapter: 1, startDay: 54, days: 5 }, // Feb 24–28
  { book: '2 Kings', startChapter: 6, startDay: 59, days: 20 }, // Mar 1–20
  { book: '1 Chronicles', startChapter: 1, startDay: 79, days: 11 }, // Mar 21–31
  { book: '1 Chronicles', startChapter: 12, startDay: 90, days: 18 }, // Apr 1–18
  { book: '2 Chronicles', startChapter: 1, startDay: 108, days: 12 }, // Apr 19–30
  { book: '2 Chronicles', startChapter: 13, startDay: 120, days: 24 }, // May 1–24
  { book: 'Ezra', startChapter: 1, startDay: 144, days: 7 }, // May 25–31
  { book: 'Ezra', startChapter: 8, startDay: 151, days: 3 }, // Jun 1–3
  { book: 'Nehemiah', startChapter: 1, startDay: 154, days: 13 }, // Jun 4–16
  { book: 'Esther', startChapter: 1, startDay: 167, days: 10 }, // Jun 17–26
  { book: 'Job', startChapter: 1, startDay: 177, days: 4 }, // Jun 27–30
  { book: 'Job', startChapter: 5, startDay: 181, days: 31 }, // Jul 1–31
  { book: 'Job', startChapter: 36, startDay: 212, days: 7 }, // Aug 1–7
  { book: 'Psalms', startChapter: 1, startDay: 219, days: 24 }, // Aug 8–31
  { book: 'Psalms', startChapter: 25, startDay: 243, days: 30 }, // Sep 1–30
  { book: 'Psalms', startChapter: 55, startDay: 273, days: 31 }, // Oct 1–31
  { book: 'Psalms', startChapter: 86, startDay: 304, days: 30 }, // Nov 1–30
  { book: 'Psalms', startChapter: 116, startDay: 334, days: 31 }, // Dec 1–31
];

const BHP_2026_YEAR_START_UTC = Date.UTC(2026, 0, 1);

function bhpChapterForDayOfYear(dayOfYear: number): ChapterADayEntry | null {
  for (const run of BHP_2026_RUNS) {
    if (dayOfYear >= run.startDay && dayOfYear < run.startDay + run.days) {
      return { book: run.book, chapter: run.startChapter + (dayOfYear - run.startDay) };
    }
  }
  return null;
}

// A fixed reference point: Jan 1, 2024 = Genesis 1. Cycles through every chapter in
// canonical order (Genesis 1 → Revelation 22, then back to Genesis 1) — used as a
// fallback for any date the BHP calendar above doesn't cover, so "today's chapter"
// still always resolves to something and never runs out.
const EPOCH_UTC = Date.UTC(2024, 0, 1);

const TOTAL_CHAPTERS = BIBLE_BOOKS.reduce((sum, b) => sum + b.chapters, 0);

function chapterAtIndex(index: number): ChapterADayEntry {
  let i = index;
  for (const book of BIBLE_BOOKS) {
    if (i < book.chapters) return { book: book.name, chapter: i + 1 };
    i -= book.chapters;
  }
  return { book: BIBLE_BOOKS[0].name, chapter: 1 };
}

export function getChapterADay(date: Date = new Date()): ChapterADayEntry {
  const todayUTC = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

  if (date.getFullYear() === 2026) {
    const dayOfYear = Math.floor((todayUTC - BHP_2026_YEAR_START_UTC) / 86_400_000);
    const bhpChapter = bhpChapterForDayOfYear(dayOfYear);
    if (bhpChapter) return bhpChapter;
  }

  const daysSinceEpoch = Math.floor((todayUTC - EPOCH_UTC) / 86_400_000);
  const index = ((daysSinceEpoch % TOTAL_CHAPTERS) + TOTAL_CHAPTERS) % TOTAL_CHAPTERS;
  return chapterAtIndex(index);
}
