import type { SQLiteDatabase } from 'expo-sqlite';

export const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink'] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

// Shared swatch hex values for every paragraph/verse-style highlighter in the app (Bible,
// EGW books, Sabbath School lessons) — one place to keep them visually consistent.
export const HIGHLIGHT_HEX: Record<'light' | 'dark', Record<HighlightColor, string>> = {
  light: { yellow: '#FEF3C7', green: '#D1FAE5', blue: '#DBEAFE', pink: '#FCE7F3' },
  dark: { yellow: '#4A3B12', green: '#0F3D2E', blue: '#0F2A4A', pink: '#3D1530' },
};

export type Highlight = { id: number; book: string; chapter: number; verse: number; color: HighlightColor; created_date: string };

export async function getAllHighlights(db: SQLiteDatabase): Promise<Highlight[]> {
  return db.getAllAsync<Highlight>('SELECT * FROM highlights ORDER BY created_date DESC');
}

export async function getHighlightsForChapter(
  db: SQLiteDatabase,
  book: string,
  chapter: number
): Promise<Map<number, HighlightColor>> {
  const rows = await db.getAllAsync<{ verse: number; color: HighlightColor }>(
    'SELECT verse, color FROM highlights WHERE book = ? AND chapter = ?',
    book,
    chapter
  );
  return new Map(rows.map((r) => [r.verse, r.color]));
}

export async function toggleHighlightColor(
  db: SQLiteDatabase,
  book: string,
  chapter: number,
  verse: number,
  color: HighlightColor
): Promise<HighlightColor | null> {
  const existing = await db.getFirstAsync<{ id: number; color: HighlightColor }>(
    'SELECT id, color FROM highlights WHERE book = ? AND chapter = ? AND verse = ?',
    book,
    chapter,
    verse
  );

  if (existing && existing.color === color) {
    await db.runAsync('DELETE FROM highlights WHERE id = ?', existing.id);
    return null;
  }
  if (existing) {
    await db.runAsync('UPDATE highlights SET color = ? WHERE id = ?', color, existing.id);
    return color;
  }
  await db.runAsync(
    'INSERT INTO highlights (book, chapter, verse, color, created_date) VALUES (?, ?, ?, ?, ?)',
    book,
    chapter,
    verse,
    color,
    new Date().toISOString()
  );
  return color;
}
