import type { SQLiteDatabase } from 'expo-sqlite';
import { getKv, setKv } from '@/database/kv';
import {
  hasQuarter,
  quarterVariantId,
  saveQuarter,
  SabbathBlock,
  SabbathDay,
  SabbathLesson,
  SabbathQuarterData,
} from '@/database/sabbathSchool';

// The official Sabbath School app (Adventech, for the GC Sabbath School & Personal
// Ministries department) has no public API — but its content repo is public, unauthenticated,
// and served as plain files over the raw.githubusercontent.com CDN (no GitHub API rate limit).
// Content itself carries a GC copyright notice restricting reproduction without written
// authorization — this app only caches it locally for the signed-in user's own offline
// reading, the same personal-use basis already applied to other copyrighted sources here.
const REPO_ROOT = 'https://raw.githubusercontent.com/Adventech/sabbath-school-lessons/stage/src';
const LAST_SYNC_KEY = 'sabbath_school_last_sync';
const WEEKS_PER_QUARTER = 13;
const DAYS_PER_WEEK = 7;

async function fetchText(url: string, timeoutMs = 8000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Sabbath School quarters run on calendar quarters (2026-01 = Jan-Mar 2026), though the
// actual start date is the last Saturday of the prior month.
export function quarterCodeForDate(date: Date): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-0${quarter}`;
}

function shiftQuarter(code: string, delta: number): string {
  const [yearStr, qStr] = code.split('-');
  let year = Number(yearStr);
  let q = Number(qStr) + delta;
  while (q < 1) {
    q += 4;
    year -= 1;
  }
  while (q > 4) {
    q -= 4;
    year += 1;
  }
  return `${year}-0${q}`;
}

function parseYamlScalars(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([a-zA-Z_]+):\s*"?([^"]*)"?\s*$/);
    if (m && m[2] !== undefined && !line.trim().startsWith('-')) {
      out[m[1]] = m[2].trim();
    }
  }
  return out;
}

function parseDayFile(raw: string): { title: string; date: string; blocks: SabbathBlock[] } | null {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) return null;
  const meta = parseYamlScalars(fmMatch[1]);
  const body = fmMatch[2];

  const blocks: SabbathBlock[] = [];
  const lines = body.split('\n');
  let buf: string[] = [];
  let bufType: SabbathBlock['type'] = 'paragraph';
  const flush = () => {
    if (buf.length) {
      const text = cleanInline(buf.join(' '));
      if (text) blocks.push({ type: bufType, text });
    }
    buf = [];
    bufType = 'paragraph';
  };
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^#{2,6}\s+/.test(line)) {
      flush();
      blocks.push({ type: 'heading', text: cleanInline(line.replace(/^#{2,6}\s+/, '')) });
      continue;
    }
    // Discussion questions are wrapped in a single backtick-fenced line in the source —
    // the only reliable signal separating them from ordinary prose (some end in "?" too).
    const questionMatch = line.trim().match(/^`(.+)`$/);
    if (questionMatch) {
      flush();
      blocks.push({ type: 'question', text: cleanInline(questionMatch[1]) });
      continue;
    }
    // A lone "**Discussion Questions**:" style line is a bold sub-heading, not body prose.
    const boldLabelMatch = line.trim().match(/^\*\*(.+?)\*\*(:?)\s*$/);
    if (boldLabelMatch) {
      flush();
      blocks.push({ type: 'heading', text: cleanInline(boldLabelMatch[1]) + boldLabelMatch[2] });
      continue;
    }
    if (/^>\s?/.test(line)) {
      if (bufType !== 'quote') flush();
      bufType = 'quote';
      buf.push(line.replace(/^>\s?/, ''));
      continue;
    }
    if (/^-{3,}\s*$/.test(line)) {
      flush();
      continue;
    }
    if (bufType === 'quote') flush();
    buf.push(line.trim());
  }
  flush();

  return { title: meta.title ?? '', date: meta.date ?? '', blocks };
}

function cleanInline(text: string): string {
  return text
    .replace(/<\/?p>/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/_\*?/g, '')
    .replace(/\\/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchQuarter(lang: string, code: string, edition: string): Promise<SabbathQuarterData | null> {
  const folder = `${code}${edition}`;
  const base = `${REPO_ROOT}/${lang}/${folder}`;
  const infoRaw = await fetchText(`${base}/info.yml`);
  if (!infoRaw) return null;
  const info = parseYamlScalars(infoRaw);

  const lessons: SabbathLesson[] = [];
  for (let week = 1; week <= WEEKS_PER_QUARTER; week++) {
    const weekCode = String(week).padStart(2, '0');
    const days: SabbathDay[] = [];
    for (let day = 1; day <= DAYS_PER_WEEK; day++) {
      const dayCode = String(day).padStart(2, '0');
      const raw = await fetchText(`${base}/${weekCode}/${dayCode}.md`);
      if (!raw) continue;
      const parsed = parseDayFile(raw);
      if (parsed) days.push({ day, title: parsed.title, date: parsed.date, blocks: parsed.blocks });
    }
    if (days.length === 0) continue;
    lessons.push({ week, title: days[0].title, startDate: days[0].date, days });
  }
  if (lessons.length === 0) return null;

  return {
    id: quarterVariantId(lang, code, edition),
    code,
    lang,
    edition,
    title: info.title ?? code,
    description: info.description ?? '',
    humanDate: info.human_date ?? '',
    startDate: info.start_date ?? '',
    endDate: info.end_date ?? '',
    cover: `${base}/cover.png`,
    lessons,
  };
}

export type SyncResult = { synced: boolean; code?: string; reason?: string };

// Called on app launch/foreground and from the manual Update button — the standard
// edition, in English and chiShona (the two defaults everyone gets automatically). Other
// editions (e.g. Easy Reading) are opt-in downloads via syncSpecificQuarter, triggered
// from the language picker, never automatically. Only ever moves forward: the current
// quarter and the next one — past quarters are never auto-downloaded, only kept if
// already on the device.
export async function syncSabbathSchool(db: SQLiteDatabase, options: { force?: boolean } = {}): Promise<SyncResult> {
  const today = new Date();
  const candidates = [quarterCodeForDate(today), shiftQuarter(quarterCodeForDate(today), 1)];
  const languages = ['en', 'sn'];

  let syncedAny = false;
  for (const lang of languages) {
    for (const code of candidates) {
      const id = quarterVariantId(lang, code, '');
      if (!options.force && (await hasQuarter(db, id))) continue;
      const quarter = await fetchQuarter(lang, code, '');
      if (!quarter) continue;
      await saveQuarter(db, quarter);
      syncedAny = true;
    }
  }
  if (syncedAny) {
    await setKv(db, LAST_SYNC_KEY, new Date().toISOString());
    return { synced: true };
  }
  return { synced: false, reason: 'No new quarter available or offline' };
}

const TRANSLATION_LAG_LOOKBACK = 4;

// Explicit, user-triggered download of a specific language/edition — used by the
// Sabbath School screen's language picker, never called automatically. Non-English
// translations (and Easy Reading) commonly lag a quarter or more behind the English
// original, so if the current quarter isn't translated yet, step backward until we find
// the most recent one that is, rather than reporting "not available" for a quarter that
// simply hasn't been translated yet.
export async function syncSpecificQuarter(
  db: SQLiteDatabase,
  lang: string,
  edition: string,
  code: string = quarterCodeForDate(new Date())
): Promise<SyncResult> {
  let candidate = code;
  for (let i = 0; i <= TRANSLATION_LAG_LOOKBACK; i++) {
    const quarter = await fetchQuarter(lang, candidate, edition);
    if (quarter) {
      await saveQuarter(db, quarter);
      return { synced: true, code: candidate };
    }
    candidate = shiftQuarter(candidate, -1);
  }
  return { synced: false, reason: 'Not available for this language/edition yet' };
}

export async function getLastSyncTime(db: SQLiteDatabase): Promise<string | null> {
  return getKv(db, LAST_SYNC_KEY);
}
