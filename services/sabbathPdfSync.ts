import type { SQLiteDatabase } from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';
import { deletePdfLesson, SabbathPdfFile, savePdfLesson } from '@/database/sabbathPdfLessons';
import { fetchText, parseYamlScalars, quarterCodeForDate, REPO_ROOT, shiftQuarter } from './sabbathSchoolSync';

// Cornerstone Connections and Junior PowerPoints are published as PDFs, not the day-by-day
// text format services/sabbathSchoolSync.ts handles — see the comment on SABBATH_AGE_DIVISIONS
// in database/sabbathSchool.ts for why (and why Real Time Faith isn't here at all). The
// title/human_date metadata is still pulled from the Adventech repo's public info.yml (same
// as the text-lesson path) — only the actual PDFs come from each division's own official site.
type PdfSiteConfig = { site: string; group: string; codePrefix: string };
const PDF_SITES: Record<string, PdfSiteConfig> = {
  '-cc': { site: 'https://www.cornerstoneconnections.net', group: 'teens', codePrefix: 'CC' },
  '-pp': { site: 'https://www.juniorpowerpoints.org', group: 'juniors', codePrefix: 'PP' },
};

const WEEKS_PER_QUARTER = 13;
const TRANSLATION_LAG_LOOKBACK = 4;

export type PdfSyncProgress = { current: number; total: number; label: string };
export type PdfSyncResult = { synced: boolean; code?: string; reason?: string };

// Module-level singleton, same reasoning as sabbathSchoolSync.ts's syncTask — a division's
// PDF set is dozens of individual file downloads, and the screen that started it can be
// exited mid-download without interrupting it. Deliberately separate from that other
// singleton: a PDF division download and a text-lesson check can proceed independently.
let syncTask: Promise<PdfSyncResult> | null = null;
let syncingDivision: string | null = null;
let syncProgress: PdfSyncProgress | null = null;
const listeners = new Set<(p: PdfSyncProgress | null) => void>();

export function isSyncingPdfLesson(): boolean {
  return syncTask !== null;
}

export function getSyncingPdfDivision(): string | null {
  return syncingDivision;
}

export function getPdfSyncProgress(): PdfSyncProgress | null {
  return syncProgress;
}

export function getActivePdfSyncTask(): Promise<PdfSyncResult> | null {
  return syncTask;
}

export function subscribePdfSync(listener: (p: PdfSyncProgress | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setProgress(p: PdfSyncProgress | null): void {
  syncProgress = p;
  listeners.forEach((listener) => listener(p));
}

// This app's internal quarter code is "YYYY-0N" (see quarterCodeForDate) — these division
// sites instead key their asset paths by full year + a single-digit quarter number + a
// 2-digit year, e.g. code "2026-03" -> year "2026", q "3", yy "26".
function quarterUrlParams(code: string): { year: string; q: string; yy: string } {
  const [year, qStr] = code.split('-');
  return { year, q: String(Number(qStr)), yy: year.slice(2) };
}

async function downloadOne(url: string, destination: File): Promise<boolean> {
  try {
    await File.downloadFileAsync(url, destination, { idempotent: true });
    return true;
  } catch {
    return false;
  }
}

async function downloadQuarterPdfs(
  db: SQLiteDatabase,
  division: string,
  config: PdfSiteConfig,
  code: string,
  info: Record<string, string>
): Promise<boolean> {
  const { year, q, yy } = quarterUrlParams(code);
  const dir = new Directory(Paths.document, 'sabbath_pdfs', division.replace('-', ''), code);
  if (!dir.exists) dir.create({ intermediates: true });

  const targets: { filename: string; week: number | null; label: string; isTeacher: boolean }[] = [
    { filename: 'Intro', week: null, label: 'Introduction', isTeacher: false },
    ...Array.from({ length: WEEKS_PER_QUARTER }, (_, i) => ({
      filename: `L${String(i + 1).padStart(2, '0')}`,
      week: i + 1,
      label: `Lesson ${i + 1}`,
      isTeacher: false,
    })),
    { filename: 'Intro-T', week: null, label: 'Introduction', isTeacher: true },
    ...Array.from({ length: WEEKS_PER_QUARTER }, (_, i) => ({
      filename: `L${String(i + 1).padStart(2, '0')}-T`,
      week: i + 1,
      label: `Lesson ${i + 1}`,
      isTeacher: true,
    })),
  ];

  const files: SabbathPdfFile[] = [];
  const total = targets.length;
  let done = 0;
  for (const target of targets) {
    const displayLabel = target.isTeacher ? `${target.label} — Teacher's Guide` : target.label;
    setProgress({ current: done, total, label: `Downloading ${displayLabel}…` });
    const url = `${config.site}/assets/${config.group}/Lessons/${year}/Q${q}/English/${target.isTeacher ? 'Teacher' : 'Student'}/${config.codePrefix}-${yy}-Q${q}-${target.filename}.pdf`;
    const destination = new File(dir, `${config.codePrefix}-${yy}-Q${q}-${target.filename}.pdf`);
    const ok = await downloadOne(url, destination);
    if (ok) files.push({ week: target.week, label: target.label, isTeacher: target.isTeacher, uri: destination.uri });
    done += 1;
    setProgress({ current: done, total, label: `Downloading ${displayLabel}…` });
  }

  // The Teacher's Guide is a bonus (not confirmed to exist for every division), but the
  // Student intro + all 13 lessons are the actual "this quarter/division is real" signal —
  // if most of those are missing, treat the whole attempt as failed rather than saving a
  // half-complete quarter (retryable later, e.g. after a flaky connection).
  const studentCount = files.filter((f) => !f.isTeacher).length;
  if (studentCount < WEEKS_PER_QUARTER + 1) return false;

  await savePdfLesson(db, { division, code, title: info.title ?? code, humanDate: info.human_date ?? '', files });
  return true;
}

// Explicit, user-triggered download of one PDF-format division — mirrors
// syncSpecificQuarter's "step back a quarter at a time" behavior for translation/
// publication lag, gated on the same repo's public info.yml existing for that
// division/quarter before attempting the (much heavier) PDF downloads themselves.
export function syncPdfDivision(
  db: SQLiteDatabase,
  division: string,
  code: string = quarterCodeForDate(new Date())
): Promise<PdfSyncResult> {
  const config = PDF_SITES[division];
  if (!config) return Promise.resolve({ synced: false, reason: 'Unsupported division' });
  if (syncTask) return syncTask;

  syncingDivision = division;
  syncTask = (async () => {
    try {
      let candidate = code;
      for (let i = 0; i <= TRANSLATION_LAG_LOOKBACK; i++) {
        setProgress({ current: 0, total: 0, label: `Checking ${candidate}…` });
        const infoRaw = await fetchText(`${REPO_ROOT}/en/${candidate}${division}/info.yml`);
        if (infoRaw) {
          const info = parseYamlScalars(infoRaw);
          const ok = await downloadQuarterPdfs(db, division, config, candidate, info);
          if (ok) return { synced: true, code: candidate };
        }
        candidate = shiftQuarter(candidate, -1);
      }
      return { synced: false, reason: 'Not available for this division yet' };
    } finally {
      syncTask = null;
      syncingDivision = null;
      setProgress(null);
    }
  })();

  return syncTask;
}

// Removes both the DB row and the actual downloaded files — without this, deleting just
// the row would leave the PDFs orphaned on disk with nothing tracking them.
export async function deletePdfLessonAndFiles(db: SQLiteDatabase, id: string, division: string, code: string): Promise<void> {
  await deletePdfLesson(db, id);
  try {
    const dir = new Directory(Paths.document, 'sabbath_pdfs', division.replace('-', ''), code);
    if (dir.exists) dir.delete();
  } catch {
    // Best-effort cleanup — a leftover folder isn't harmful if this fails.
  }
}
