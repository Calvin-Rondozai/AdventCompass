import type { SQLiteDatabase } from 'expo-sqlite';
import { HighlightColor } from './highlights';

// Shared table for every content-type reader that isn't Bible verses (`highlights`) or
// Sabbath School (`sabbath_highlights`) — see database/schema.ts for why those two keep
// their own dedicated tables. `contentKey` identifies one page within `contentType`
// (e.g. commentary uses "Genesis|1", beliefs uses the belief number, sermons use the
// sermon id); `blockIndex` is the paragraph/entry within that page.
export type ContentType = 'commentary' | 'beliefs' | 'sermon' | 'egw';
export type WordHighlight = { id: number; blockIndex: number; startWord: number; endWord: number; color: HighlightColor };

export async function getWordHighlights(
  db: SQLiteDatabase,
  contentType: ContentType,
  contentKey: string
): Promise<Map<number, WordHighlight[]>> {
  const rows = await db.getAllAsync<{ id: number; block_index: number; start_word: number; end_word: number; color: HighlightColor }>(
    'SELECT id, block_index, start_word, end_word, color FROM word_highlights WHERE content_type = ? AND content_key = ?',
    contentType,
    contentKey
  );
  const map = new Map<number, WordHighlight[]>();
  for (const r of rows) {
    const list = map.get(r.block_index) ?? [];
    list.push({ id: r.id, blockIndex: r.block_index, startWord: r.start_word, endWord: r.end_word, color: r.color });
    map.set(r.block_index, list);
  }
  return map;
}

export async function addWordHighlight(
  db: SQLiteDatabase,
  contentType: ContentType,
  contentKey: string,
  blockIndex: number,
  startWord: number,
  endWord: number,
  color: HighlightColor
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO word_highlights (content_type, content_key, block_index, start_word, end_word, color, created_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
    contentType,
    contentKey,
    blockIndex,
    startWord,
    endWord,
    color,
    new Date().toISOString()
  );
  return result.lastInsertRowId;
}

export async function removeWordHighlight(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM word_highlights WHERE id = ?', id);
}
