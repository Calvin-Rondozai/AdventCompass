import type { SQLiteDatabase } from 'expo-sqlite';
import { getKv, setKv } from './kv';
import { getReadingPlan, type ReadingPlan } from './readingPlans';

const KEY = 'custom_reading_plans';

export async function getCustomPlans(db: SQLiteDatabase): Promise<ReadingPlan[]> {
  const value = await getKv(db, KEY);
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

async function saveCustomPlans(db: SQLiteDatabase, plans: ReadingPlan[]): Promise<void> {
  await setKv(db, KEY, JSON.stringify(plans));
}

export async function addCustomPlan(db: SQLiteDatabase, plan: ReadingPlan): Promise<void> {
  const plans = await getCustomPlans(db);
  plans.push(plan);
  await saveCustomPlans(db, plans);
}

export async function deleteCustomPlan(db: SQLiteDatabase, id: string): Promise<void> {
  const plans = await getCustomPlans(db);
  await saveCustomPlans(
    db,
    plans.filter((p) => p.id !== id)
  );
}

// Looks up a plan by id across both the built-in suggested plans and this device's
// custom ones — used wherever only a plan id is stored (e.g. the active daily-verse
// source) and either kind could be the match.
export async function findAnyPlan(db: SQLiteDatabase, id: string): Promise<ReadingPlan | undefined> {
  return getReadingPlan(id) ?? (await getCustomPlans(db)).find((p) => p.id === id);
}
