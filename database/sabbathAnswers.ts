import type { SQLiteDatabase } from 'expo-sqlite';

export async function getSabbathAnswers(
  db: SQLiteDatabase,
  quarterId: string,
  week: number,
  day: number
): Promise<Map<number, string>> {
  const rows = await db.getAllAsync<{ block_index: number; answer: string }>(
    'SELECT block_index, answer FROM sabbath_answers WHERE quarter_id = ? AND week = ? AND day = ?',
    quarterId,
    week,
    day
  );
  return new Map(rows.map((r) => [r.block_index, r.answer]));
}

export async function saveSabbathAnswer(
  db: SQLiteDatabase,
  quarterId: string,
  week: number,
  day: number,
  blockIndex: number,
  answer: string
): Promise<void> {
  await db.runAsync(
    `INSERT INTO sabbath_answers (quarter_id, week, day, block_index, answer, updated_date)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(quarter_id, week, day, block_index) DO UPDATE SET answer = excluded.answer, updated_date = excluded.updated_date`,
    quarterId,
    week,
    day,
    blockIndex,
    answer,
    new Date().toISOString()
  );
}
