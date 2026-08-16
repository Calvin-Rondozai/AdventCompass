import type { SQLiteDatabase } from 'expo-sqlite';

export type SabbathPdfFile = {
  week: number | null; // null = the quarter's introduction, not a numbered week
  label: string; // "Introduction" or "Lesson N" — never includes "Teacher's Guide", see isTeacher
  isTeacher: boolean;
  uri: string;
};

export type SabbathPdfLesson = {
  id: string;
  division: string;
  code: string;
  title: string;
  humanDate: string;
  files: SabbathPdfFile[];
  downloadedAt: string;
};

type SabbathPdfLessonRow = {
  id: string;
  division: string;
  code: string;
  title: string;
  human_date: string;
  files: string;
  downloaded_at: string;
};

function fromRow(row: SabbathPdfLessonRow): SabbathPdfLesson {
  return {
    id: row.id,
    division: row.division,
    code: row.code,
    title: row.title,
    humanDate: row.human_date,
    files: JSON.parse(row.files),
    downloadedAt: row.downloaded_at,
  };
}

export function pdfLessonId(division: string, code: string): string {
  return `${division}:${code}`;
}

export async function getDownloadedPdfLessons(db: SQLiteDatabase): Promise<SabbathPdfLesson[]> {
  const rows = await db.getAllAsync<SabbathPdfLessonRow>(
    'SELECT id, division, code, title, human_date, files, downloaded_at FROM sabbath_pdf_lessons ORDER BY code DESC'
  );
  return rows.map(fromRow);
}

export async function getPdfLesson(db: SQLiteDatabase, id: string): Promise<SabbathPdfLesson | null> {
  const row = await db.getFirstAsync<SabbathPdfLessonRow>(
    'SELECT id, division, code, title, human_date, files, downloaded_at FROM sabbath_pdf_lessons WHERE id = ?',
    id
  );
  return row ? fromRow(row) : null;
}

export async function savePdfLesson(
  db: SQLiteDatabase,
  lesson: { division: string; code: string; title: string; humanDate: string; files: SabbathPdfFile[] }
): Promise<void> {
  await db.runAsync(
    `INSERT INTO sabbath_pdf_lessons (id, division, code, title, human_date, files, downloaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title, human_date = excluded.human_date, files = excluded.files,
       downloaded_at = excluded.downloaded_at`,
    pdfLessonId(lesson.division, lesson.code),
    lesson.division,
    lesson.code,
    lesson.title,
    lesson.humanDate,
    JSON.stringify(lesson.files),
    new Date().toISOString()
  );
}

export async function deletePdfLesson(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM sabbath_pdf_lessons WHERE id = ?', id);
}
