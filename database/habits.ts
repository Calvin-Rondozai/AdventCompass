import type { SQLiteDatabase } from 'expo-sqlite';

export type HabitType = 'bible_study' | 'prayer' | 'water' | 'exercise';

export const WATER_GOAL_ML = 2000;
export const WATER_STEP_ML = 250;
export const EXERCISE_GOAL_MIN = 30;
export const EXERCISE_STEP_MIN = 10;

// 1 cup = 250ml, so 4 cups = 1 liter — shown to users instead of raw ml.
export const ML_PER_CUP = 250;
export const mlToCups = (ml: number) => Math.round(ml / ML_PER_CUP);

export type HabitRow = { id: number; habit_type: HabitType; completed: number; value: number; date: string };

export function todayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export async function getHabitsForDate(db: SQLiteDatabase, date: string): Promise<HabitRow[]> {
  return db.getAllAsync<HabitRow>('SELECT * FROM habits WHERE date = ?', date);
}

export async function toggleHabit(db: SQLiteDatabase, habitType: HabitType, date: string): Promise<void> {
  const existing = await db.getFirstAsync<HabitRow>(
    'SELECT * FROM habits WHERE habit_type = ? AND date = ?',
    habitType,
    date
  );
  if (existing) {
    await db.runAsync('UPDATE habits SET completed = ? WHERE id = ?', existing.completed ? 0 : 1, existing.id);
  } else {
    await db.runAsync(
      'INSERT INTO habits (habit_type, completed, value, date) VALUES (?, 1, 0, ?)',
      habitType,
      date
    );
  }
}

export async function addWater(db: SQLiteDatabase, date: string, amountMl: number, goalMl: number = WATER_GOAL_ML): Promise<number> {
  const existing = await db.getFirstAsync<HabitRow>(
    'SELECT * FROM habits WHERE habit_type = ? AND date = ?',
    'water',
    date
  );
  const nextValue = Math.max(0, (existing?.value ?? 0) + amountMl);
  const completed = nextValue >= goalMl ? 1 : 0;
  if (existing) {
    await db.runAsync('UPDATE habits SET value = ?, completed = ? WHERE id = ?', nextValue, completed, existing.id);
  } else {
    await db.runAsync(
      'INSERT INTO habits (habit_type, completed, value, date) VALUES (?, ?, ?, ?)',
      'water',
      completed,
      nextValue,
      date
    );
  }
  return nextValue;
}

export async function addExercise(db: SQLiteDatabase, date: string, minutes: number, goalMinutes: number): Promise<number> {
  const existing = await db.getFirstAsync<HabitRow>(
    'SELECT * FROM habits WHERE habit_type = ? AND date = ?',
    'exercise',
    date
  );
  const nextValue = Math.max(0, (existing?.value ?? 0) + minutes);
  const completed = nextValue >= goalMinutes ? 1 : 0;
  if (existing) {
    await db.runAsync('UPDATE habits SET value = ?, completed = ? WHERE id = ?', nextValue, completed, existing.id);
  } else {
    await db.runAsync(
      'INSERT INTO habits (habit_type, completed, value, date) VALUES (?, ?, ?, ?)',
      'exercise',
      completed,
      nextValue,
      date
    );
  }
  return nextValue;
}

// ponytail: bounded to ~14 months back so this query stays small (and able to use
// idx_habits_type_date) no matter how long someone's been using the app — the habits
// table only ever grows, and a real streak longer than that is vanishingly rare. Raise
// the lookback if that ever stops being true.
const STREAK_LOOKBACK_DAYS = 420;

export async function getStreak(db: SQLiteDatabase, habitType: HabitType, fromDate: Date = new Date()): Promise<number> {
  const cutoff = new Date(fromDate);
  cutoff.setDate(cutoff.getDate() - STREAK_LOOKBACK_DAYS);
  const rows = await db.getAllAsync<{ date: string }>(
    'SELECT date FROM habits WHERE habit_type = ? AND completed = 1 AND date >= ? ORDER BY date DESC',
    habitType,
    todayKey(cutoff)
  );
  const completedDates = new Set(rows.map((r) => r.date));

  let streak = 0;
  const cursor = new Date(fromDate);
  while (completedDates.has(todayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export type WeekDay = { date: string; label: string; completed: boolean };

export async function getWeekCompletion(
  db: SQLiteDatabase,
  habitType: HabitType,
  fromDate: Date = new Date()
): Promise<WeekDay[]> {
  const start = new Date(fromDate);
  start.setDate(start.getDate() - 6);
  const rows = await db.getAllAsync<{ date: string }>(
    'SELECT date FROM habits WHERE habit_type = ? AND completed = 1 AND date >= ?',
    habitType,
    todayKey(start)
  );
  const completedDates = new Set(rows.map((r) => r.date));

  const days: WeekDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const cursor = new Date(fromDate);
    cursor.setDate(cursor.getDate() - i);
    const key = todayKey(cursor);
    days.push({
      date: key,
      label: cursor.toLocaleDateString(undefined, { weekday: 'narrow' }),
      completed: completedDates.has(key),
    });
  }
  return days;
}
