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

export async function toggleHabit(db: SQLiteDatabase, habitType: HabitType | string, date: string): Promise<void> {
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

export async function getStreak(db: SQLiteDatabase, habitType: HabitType | string, fromDate: Date = new Date()): Promise<number> {
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
  habitType: HabitType | string,
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

export type CustomHabit = {
  id: string;
  label: string;
  icon: string;
  sortOrder: number;
  archived: boolean;
  createdDate: string;
};

type CustomHabitRow = {
  id: string;
  label: string;
  icon: string;
  sort_order: number;
  archived: number;
  created_date: string;
};

function fromRow(row: CustomHabitRow): CustomHabit {
  return {
    id: row.id,
    label: row.label,
    icon: row.icon,
    sortOrder: row.sort_order,
    archived: !!row.archived,
    createdDate: row.created_date,
  };
}

export async function listCustomHabits(db: SQLiteDatabase): Promise<CustomHabit[]> {
  const rows = await db.getAllAsync<CustomHabitRow>(
    'SELECT * FROM custom_habits WHERE archived = 0 ORDER BY sort_order ASC, created_date ASC'
  );
  return rows.map(fromRow);
}

export async function addCustomHabit(db: SQLiteDatabase, label: string, icon: string): Promise<CustomHabit> {
  const id = `custom_${Date.now()}_${Math.round(Math.random() * 1000)}`;
  const createdDate = todayKey();
  const { nextOrder } = (await db.getFirstAsync<{ nextOrder: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 as nextOrder FROM custom_habits'
  )) ?? { nextOrder: 0 };
  await db.runAsync(
    'INSERT INTO custom_habits (id, label, icon, sort_order, archived, created_date) VALUES (?, ?, ?, ?, 0, ?)',
    id,
    label,
    icon,
    nextOrder,
    createdDate
  );
  return { id, label, icon, sortOrder: nextOrder, archived: false, createdDate };
}

// Soft-delete: removing a schedule item shouldn't erase its past completion history
// (still sitting in the habits table under this id, and could theoretically be restored),
// it just stops showing up in listCustomHabits going forward.
export async function archiveCustomHabit(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE custom_habits SET archived = 1 WHERE id = ?', id);
}

// Monday-anchored week-start date, used as a stable key for "has this week's summary
// already been shown" bookkeeping — see getWeeklySummaryIfDue below.
export function weekStartKey(date: Date = new Date()): string {
  const cursor = new Date(date);
  const day = cursor.getDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? 6 : day - 1;
  cursor.setDate(cursor.getDate() - diffToMonday);
  return todayKey(cursor);
}

export type WeeklySummaryStat = { type: string; label: string; icon: string; completedDays: number };

// Returns the previous Mon–Sun week's per-habit completion counts the first time this is
// called after that week has actually ended, then never again for that same week (gated by
// an app_kv row so re-opening the app the same week is a no-op). Returns null when there's
// nothing new to show (same week as last check, or this is the very first launch ever).
export async function getWeeklySummaryIfDue(
  db: SQLiteDatabase,
  habitTypes: { type: string; label: string; icon: string }[],
  now: Date = new Date()
): Promise<WeeklySummaryStat[] | null> {
  const currentWeek = weekStartKey(now);
  const lastSeen = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_kv WHERE key = 'last_week_summary_week'"
  );

  if (!lastSeen) {
    // First-ever launch: nothing to summarize yet, just start tracking from this week.
    await db.runAsync(
      "INSERT INTO app_kv (key, value) VALUES ('last_week_summary_week', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      currentWeek
    );
    return null;
  }
  if (lastSeen.value === currentWeek) return null;

  // One day before this week's Monday, computed from `now` directly (not by re-parsing
  // the currentWeek string) so this stays in local-time Date arithmetic throughout,
  // matching weekStartKey's own convention above.
  const day = now.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const lastWeekSunday = new Date(now);
  lastWeekSunday.setDate(lastWeekSunday.getDate() - diffToMonday - 1);

  const stats = await Promise.all(
    habitTypes.map(async ({ type, label, icon }) => {
      const days = await getWeekCompletion(db, type, lastWeekSunday);
      return { type, label, icon, completedDays: days.filter((d) => d.completed).length };
    })
  );

  await db.runAsync(
    "INSERT INTO app_kv (key, value) VALUES ('last_week_summary_week', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    currentWeek
  );

  return stats;
}
