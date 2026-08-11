import type { SQLiteDatabase } from 'expo-sqlite';
import { getKv, setKv } from './kv';

const KEY = 'active_reading_plan_id';

// null means "no plan selected" — the daily verse falls back to picking from the whole
// Bible (see getVerseOfDay). Stored as '' rather than deleting the row, matching how
// every other app_kv-backed preference in this app is cleared.
export async function getActiveReadingPlanId(db: SQLiteDatabase): Promise<string | null> {
  const value = await getKv(db, KEY);
  return value || null;
}

export async function setActiveReadingPlanId(db: SQLiteDatabase, id: string | null): Promise<void> {
  await setKv(db, KEY, id ?? '');
}
