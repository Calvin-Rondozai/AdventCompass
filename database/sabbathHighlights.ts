import type { SQLiteDatabase } from 'expo-sqlite';
import { HighlightColor } from './highlights';

export async function getSabbathHighlights(
  db: SQLiteDatabase,
  quarterId: string,
  week: number,
  day: number
): Promise<Map<number, HighlightColor>> {
  const rows = await db.getAllAsync<{ block_index: number; color: HighlightColor }>(
    'SELECT block_index, color FROM sabbath_highlights WHERE quarter_id = ? AND week = ? AND day = ?',
    quarterId,
    week,
    day
  );
  return new Map(rows.map((r) => [r.block_index, r.color]));
}

export async function toggleSabbathHighlightColor(
  db: SQLiteDatabase,
  quarterId: string,
  week: number,
  day: number,
  blockIndex: number,
  color: HighlightColor
): Promise<HighlightColor | null> {
  const existing = await db.getFirstAsync<{ id: number; color: HighlightColor }>(
    'SELECT id, color FROM sabbath_highlights WHERE quarter_id = ? AND week = ? AND day = ? AND block_index = ?',
    quarterId,
    week,
    day,
    blockIndex
  );

  if (existing && existing.color === color) {
    await db.runAsync('DELETE FROM sabbath_highlights WHERE id = ?', existing.id);
    return null;
  }
  if (existing) {
    await db.runAsync('UPDATE sabbath_highlights SET color = ? WHERE id = ?', color, existing.id);
    return color;
  }
  await db.runAsync(
    'INSERT INTO sabbath_highlights (quarter_id, week, day, block_index, color, created_date) VALUES (?, ?, ?, ?, ?, ?)',
    quarterId,
    week,
    day,
    blockIndex,
    color,
    new Date().toISOString()
  );
  return color;
}
