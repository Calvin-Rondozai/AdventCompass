import type { SQLiteDatabase } from 'expo-sqlite';
import type { HymnalLanguage } from './hymnal';

export type HymnFavorite = { id: number; language: HymnalLanguage; number: number; created_date: string };

export async function getFavoriteHymnNumbers(db: SQLiteDatabase, language: HymnalLanguage): Promise<Set<number>> {
  const rows = await db.getAllAsync<{ number: number }>(
    'SELECT number FROM hymn_favorites WHERE language = ?',
    language
  );
  return new Set(rows.map((r) => r.number));
}

export async function toggleHymnFavorite(db: SQLiteDatabase, language: HymnalLanguage, number: number): Promise<boolean> {
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM hymn_favorites WHERE language = ? AND number = ?',
    language,
    number
  );
  if (existing) {
    await db.runAsync('DELETE FROM hymn_favorites WHERE id = ?', existing.id);
    return false;
  }
  await db.runAsync(
    'INSERT INTO hymn_favorites (language, number, created_date) VALUES (?, ?, ?)',
    language,
    number,
    new Date().toISOString()
  );
  return true;
}

export async function getAllHymnFavorites(db: SQLiteDatabase, language: HymnalLanguage): Promise<HymnFavorite[]> {
  return db.getAllAsync<HymnFavorite>(
    'SELECT * FROM hymn_favorites WHERE language = ? ORDER BY created_date DESC',
    language
  );
}
