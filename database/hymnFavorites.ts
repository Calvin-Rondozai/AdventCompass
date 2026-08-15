import type { SQLiteDatabase } from 'expo-sqlite';
import type { HymnalLanguage } from './hymnal';

export type HymnFavorite = { number: number; language: HymnalLanguage; created_date: string };

// Whether a hymn is favorited is global by number (favoriting #5 while reading it in
// Shona also marks it favorite in English/isiNdebele) — but the specific language it was
// favorited IN is remembered too, so the Favorites list can display and open it the way
// it was originally marked, instead of always defaulting to English.
export async function getFavoriteHymnNumbers(db: SQLiteDatabase): Promise<Set<number>> {
  const rows = await db.getAllAsync<{ number: number }>('SELECT DISTINCT number FROM hymn_favorites');
  return new Set(rows.map((r) => r.number));
}

// One row per number, in whichever language it was most recently favorited — de-duped
// in JS rather than SQL since favoriting the same number twice (unfavorite, then
// re-favorite in a different language) is a real, expected case, not a data error.
export async function getFavoriteHymns(db: SQLiteDatabase): Promise<HymnFavorite[]> {
  const rows = await db.getAllAsync<{ number: number; language: string; created_date: string }>(
    'SELECT number, language, created_date FROM hymn_favorites ORDER BY created_date DESC'
  );
  const seen = new Set<number>();
  const result: HymnFavorite[] = [];
  for (const r of rows) {
    if (seen.has(r.number)) continue;
    seen.add(r.number);
    const language: HymnalLanguage = r.language === 'shona' || r.language === 'ndebele' ? r.language : 'english';
    result.push({ number: r.number, language, created_date: r.created_date });
  }
  return result;
}

export async function toggleHymnFavorite(db: SQLiteDatabase, language: HymnalLanguage, number: number): Promise<boolean> {
  const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM hymn_favorites WHERE number = ?', number);
  if (existing) {
    await db.runAsync('DELETE FROM hymn_favorites WHERE number = ?', number);
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
