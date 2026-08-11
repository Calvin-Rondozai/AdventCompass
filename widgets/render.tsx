import React from 'react';
import { getHabitsForDate, getWeekCompletion, HabitType, todayKey } from '@/database/habits';
import { getWaterGoal } from '@/database/wellnessGoals';
import { getWidgetDb } from './widgetDb';
import { WaterTankWidget } from './WaterTankWidget';
import { WeeklyProgressWidget } from './WeeklyProgressWidget';

const WEEK_TYPES: HabitType[] = ['bible_study', 'prayer', 'exercise', 'water'];

// Shared between the headless widgetTaskHandler (widget added/resized/clicked on the
// home screen) and requestWidgetUpdate calls made from inside the running app (see
// services/widgetSync.ts) — both need to build the exact same JSX from a fresh read of
// the database, so the fetch-and-render logic lives here once instead of twice.
export async function renderWaterTank(): Promise<React.JSX.Element> {
  const db = getWidgetDb();
  const date = todayKey();
  const [rows, waterGoalMl] = await Promise.all([getHabitsForDate(db, date), getWaterGoal(db)]);
  const waterMl = rows.find((r) => r.habit_type === 'water')?.value ?? 0;
  return <WaterTankWidget waterMl={waterMl} waterGoalMl={waterGoalMl} />;
}

export async function renderWeeklyProgress(): Promise<React.JSX.Element> {
  const db = getWidgetDb();
  const results = await Promise.all(WEEK_TYPES.map((type) => getWeekCompletion(db, type)));
  const week = Object.fromEntries(WEEK_TYPES.map((type, i) => [type, results[i]])) as Record<
    HabitType,
    Awaited<ReturnType<typeof getWeekCompletion>>
  >;
  return <WeeklyProgressWidget week={week} />;
}
