import type { SQLiteDatabase } from 'expo-sqlite';

export type SabbathBlock = { type: 'heading' | 'quote' | 'paragraph' | 'question'; text: string };
export type SabbathDay = { day: number; title: string; date: string; blocks: SabbathBlock[] };
export type SabbathLesson = { week: number; title: string; startDate: string; days: SabbathDay[] };
export type SabbathQuarterData = {
  id: string;
  code: string;
  lang: string;
  edition: string;
  title: string;
  description: string;
  humanDate: string;
  startDate: string;
  endDate: string;
  cover: string | null;
  lessons: SabbathLesson[];
};

export type SabbathQuarterRow = {
  id: string;
  code: string;
  lang: string;
  edition: string;
  title: string;
  description: string;
  human_date: string;
  start_date: string;
  end_date: string;
  cover: string | null;
  downloaded_at: string;
};

export const SABBATH_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'sn', label: 'chiShona' },
];

export const SABBATH_EDITIONS: { code: string; label: string; suffix: string }[] = [
  { code: 'standard', label: 'Standard Edition', suffix: '' },
  { code: 'easy', label: 'Easy Reading Edition', suffix: '-er' },
];

// The Adventech content repo hosts a lesson quarterly per age division, not just the Adult
// one — but only some divisions actually publish the day-by-day markdown format this app's
// sync/reader is built around (verified live against the repo: src/en/2026-03-{suffix}/).
// InVerse has real 01-13 week folders full of day .md files, same shape as Adult — synced as
// `format: 'text'` via services/sabbathSchoolSync.ts. Cornerstone Connections and Junior
// PowerPoints do NOT — their quarter folders in that repo contain only PDFs, and the PDF
// URLs listed there (pdf.yml) point at a private S3 bucket that 403s on direct access. Both
// divisions DO publish those same PDFs publicly on their own official sites though (verified
// live), so they're synced as `format: 'pdf'` instead, via services/sabbathPdfSync.ts. Real
// Time Faith's own site sits behind a Cloudflare bot-challenge that blocks even a plain
// fetch, so it's left out entirely for now. Primary/Kindergarten/Beginner are left out for a
// separate reason — their folder names are namespaced to the current curriculum cycle (e.g.
// "yaijprtg") rather than a fixed suffix, so there's no stable suffix to hardcode here.
export type SabbathAgeDivision = {
  suffix: string;
  label: string;
  ageGroup: string;
  description: string;
  format: 'text' | 'pdf';
};

export const SABBATH_AGE_DIVISIONS: SabbathAgeDivision[] = [
  { suffix: '', label: 'Standard Edition', ageGroup: 'Adult', description: 'The classic Sabbath School Bible Study Guide', format: 'text' },
  { suffix: '-er', label: 'Easy Reading Edition', ageGroup: 'Adult', description: 'The same weekly lessons, in simpler language', format: 'text' },
  { suffix: '-cq', label: 'InVerse', ageGroup: 'Young Adult', description: 'Apologetics and discussion for young adults', format: 'text' },
  { suffix: '-cc', label: 'Cornerstone Connections', ageGroup: 'Earliteen', description: 'For ages 10-14 — downloaded as PDFs', format: 'pdf' },
  { suffix: '-pp', label: 'Junior PowerPoints', ageGroup: 'Junior', description: 'For ages 10-12 — downloaded as PDFs', format: 'pdf' },
];

export function quarterVariantId(lang: string, code: string, edition: string): string {
  return `${lang}:${code}:${edition}`;
}

export async function getDownloadedQuarters(db: SQLiteDatabase): Promise<SabbathQuarterRow[]> {
  return db.getAllAsync<SabbathQuarterRow>(
    'SELECT id, code, lang, edition, title, description, human_date, start_date, end_date, cover, downloaded_at FROM sabbath_quarters ORDER BY code DESC'
  );
}

export async function hasQuarter(db: SQLiteDatabase, id: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ id: string }>('SELECT id FROM sabbath_quarters WHERE id = ?', id);
  return !!row;
}

// Each quarter's `data` blob is the full 13-week/~90-day lesson (hundreds of KB of JSON) —
// parsing it is the actual cost of opening a lesson, and both the week-list screen and the
// lesson reader screen call getQuarterData for the same id back to back. Caching the parsed
// object in memory means the second call (and every day-switch within a lesson) is free
// instead of re-running SELECT + JSON.parse on the whole quarter each time.
const quarterCache = new Map<string, SabbathQuarterData>();

export async function getQuarterData(db: SQLiteDatabase, id: string): Promise<SabbathQuarterData | null> {
  const cached = quarterCache.get(id);
  if (cached) return cached;
  const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM sabbath_quarters WHERE id = ?', id);
  if (!row) return null;
  const quarter = JSON.parse(row.data);
  quarterCache.set(id, quarter);
  return quarter;
}

export async function saveQuarter(db: SQLiteDatabase, quarter: SabbathQuarterData): Promise<void> {
  quarterCache.delete(quarter.id);
  await db.runAsync(
    `INSERT INTO sabbath_quarters (id, code, lang, edition, title, description, human_date, start_date, end_date, cover, data, downloaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title, description = excluded.description, human_date = excluded.human_date,
       start_date = excluded.start_date, end_date = excluded.end_date, cover = excluded.cover, data = excluded.data,
       downloaded_at = excluded.downloaded_at`,
    quarter.id,
    quarter.code,
    quarter.lang,
    quarter.edition,
    quarter.title,
    quarter.description,
    quarter.humanDate,
    quarter.startDate,
    quarter.endDate,
    quarter.cover,
    JSON.stringify(quarter),
    new Date().toISOString()
  );
}

export async function deleteQuarter(db: SQLiteDatabase, id: string): Promise<void> {
  quarterCache.delete(id);
  await db.runAsync('DELETE FROM sabbath_quarters WHERE id = ?', id);
}

// Dates in the source content are "DD/MM/YYYY".
function parseSourceDate(s: string): number {
  const [d, m, y] = s.split('/').map(Number);
  if (!d || !m || !y) return NaN;
  return Date.UTC(y, m - 1, d);
}

export type TodaysLesson = {
  quarterId: string;
  quarterTitle: string;
  week: number;
  lessonTitle: string;
  day: number;
  dayTitle: string;
};

// The specific day (Sabbath..Friday) whose exact date is the most recent one on or before
// today, checked across every downloaded quarter/language/edition on the device — day-level
// dates are exact in the source data, unlike a lesson's nominal start date.
export async function getTodaysLesson(db: SQLiteDatabase, date: Date = new Date()): Promise<TodaysLesson | null> {
  const todayUTC = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const rows = await getDownloadedQuarters(db);
  let best: TodaysLesson | null = null;
  let bestTime = -Infinity;

  for (const row of rows) {
    const quarter = await getQuarterData(db, row.id);
    if (!quarter) continue;
    for (const lesson of quarter.lessons) {
      for (const day of lesson.days) {
        const t = parseSourceDate(day.date);
        if (Number.isNaN(t) || t > todayUTC) continue;
        if (t > bestTime) {
          bestTime = t;
          best = {
            quarterId: quarter.id,
            quarterTitle: quarter.title,
            week: lesson.week,
            lessonTitle: lesson.title,
            day: day.day,
            dayTitle: day.title,
          };
        }
      }
    }
  }
  return best;
}

export type CurrentWeekLesson = {
  quarterId: string;
  quarterTitle: string;
  week: number;
  lessonTitle: string;
  days: SabbathDay[];
};

// Same "most recent day on or before today, across every downloaded quarter" search as
// getTodaysLesson, but returns the WHOLE week's lesson (every day's blocks) instead of
// just the closest day — used by the AI Assistant's weekly-summary/leader's-guide
// answers, which need the full week's content, not one day of it.
export async function getCurrentWeekLesson(db: SQLiteDatabase, date: Date = new Date()): Promise<CurrentWeekLesson | null> {
  const todayUTC = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const rows = await getDownloadedQuarters(db);
  let best: CurrentWeekLesson | null = null;
  let bestTime = -Infinity;

  for (const row of rows) {
    const quarter = await getQuarterData(db, row.id);
    if (!quarter) continue;
    for (const lesson of quarter.lessons) {
      for (const day of lesson.days) {
        const t = parseSourceDate(day.date);
        if (Number.isNaN(t) || t > todayUTC) continue;
        if (t > bestTime) {
          bestTime = t;
          best = {
            quarterId: quarter.id,
            quarterTitle: quarter.title,
            week: lesson.week,
            lessonTitle: lesson.title,
            days: lesson.days,
          };
        }
      }
    }
  }
  return best;
}

// Turns a week's lesson into plain text suitable for feeding to the AI as grounding —
// every day's title and blocks, headings kept as headings, questions kept inline (they're
// exactly the kind of "things to discuss" a summary or leader's guide needs to draw on).
export function flattenLessonForAI(lesson: CurrentWeekLesson, maxChars: number): string {
  const lines: string[] = [`Sabbath School — Lesson ${lesson.week}: ${lesson.lessonTitle}`];
  for (const day of lesson.days) {
    lines.push(`\n${day.title}`);
    for (const block of day.blocks) {
      lines.push(block.text);
    }
  }
  const full = lines.join('\n');
  return full.length > maxChars ? `${full.slice(0, maxChars)}…` : full;
}
