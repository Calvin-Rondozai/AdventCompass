import type { SQLiteDatabase } from 'expo-sqlite';
import { HighlightColor } from './highlights';

// startWord/endWord are word indices within the block's tokenized text; -1/-1 marks a
// legacy whole-block highlight created before word ranges existed.
export type SabbathHighlight = { id: number; startWord: number; endWord: number; color: HighlightColor };

export async function getSabbathHighlights(
  db: SQLiteDatabase,
  quarterId: string,
  week: number,
  day: number
): Promise<Map<number, SabbathHighlight[]>> {
  const rows = await db.getAllAsync<{ id: number; block_index: number; start_word: number; end_word: number; color: HighlightColor }>(
    'SELECT id, block_index, start_word, end_word, color FROM sabbath_highlights WHERE quarter_id = ? AND week = ? AND day = ?',
    quarterId,
    week,
    day
  );
  const map = new Map<number, SabbathHighlight[]>();
  for (const r of rows) {
    const list = map.get(r.block_index) ?? [];
    list.push({ id: r.id, startWord: r.start_word, endWord: r.end_word, color: r.color });
    map.set(r.block_index, list);
  }
  return map;
}

export async function addSabbathHighlight(
  db: SQLiteDatabase,
  quarterId: string,
  week: number,
  day: number,
  blockIndex: number,
  startWord: number,
  endWord: number,
  color: HighlightColor
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO sabbath_highlights (quarter_id, week, day, block_index, start_word, end_word, color, created_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    quarterId,
    week,
    day,
    blockIndex,
    startWord,
    endWord,
    color,
    new Date().toISOString()
  );
  return result.lastInsertRowId;
}

export async function removeSabbathHighlight(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM sabbath_highlights WHERE id = ?', id);
}
