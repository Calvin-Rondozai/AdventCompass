import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import {
  addExercise,
  addWater,
  EXERCISE_GOAL_MIN,
  EXERCISE_STEP_MIN,
  getHabitsForDate,
  getStreak,
  getWeekCompletion,
  HabitType,
  todayKey,
  toggleHabit,
  WATER_GOAL_ML,
  WATER_STEP_ML,
  WeekDay,
} from '@/database/habits';
import { getExerciseGoal, getWaterGoal } from '@/database/wellnessGoals';

const STREAK_TYPES: HabitType[] = ['bible_study', 'prayer', 'exercise'];
const HABIT_TYPES: HabitType[] = ['bible_study', 'prayer', 'water', 'exercise'];

export function useHabits() {
  const db = useSQLiteContext();
  const [date] = useState(() => todayKey());
  const [completed, setCompleted] = useState<Record<HabitType, boolean>>({
    bible_study: false,
    prayer: false,
    water: false,
    exercise: false,
  });
  const [waterMl, setWaterMl] = useState(0);
  const [waterGoalMl, setWaterGoalMl] = useState(WATER_GOAL_ML);
  const [exerciseMin, setExerciseMin] = useState(0);
  const [exerciseGoalMin, setExerciseGoalMin] = useState(EXERCISE_GOAL_MIN);
  const [streaks, setStreaks] = useState<Record<HabitType, number>>({
    bible_study: 0,
    prayer: 0,
    water: 0,
    exercise: 0,
  });
  const [week, setWeek] = useState<Record<HabitType, WeekDay[]>>({
    bible_study: [],
    prayer: [],
    water: [],
    exercise: [],
  });
  const [loading, setLoading] = useState(true);

  // This is the home tab's data source, so an unhandled rejection here (a real
  // possibility — SQLite errors are not theoretical) would leave `loading` stuck
  // true forever with no error shown; the try/finally guarantees the spinner always
  // resolves one way or another even if a query fails.
  const refresh = useCallback(async () => {
    try {
      const [rows, wGoal, eGoal] = await Promise.all([
        getHabitsForDate(db, date),
        getWaterGoal(db),
        getExerciseGoal(db),
      ]);
      setWaterGoalMl(wGoal);
      setExerciseGoalMin(eGoal);

      const nextCompleted = { bible_study: false, prayer: false, water: false, exercise: false } as Record<
        HabitType,
        boolean
      >;
      let nextWater = 0;
      let nextExercise = 0;
      for (const row of rows) {
        nextCompleted[row.habit_type] = !!row.completed;
        if (row.habit_type === 'water') nextWater = row.value;
        if (row.habit_type === 'exercise') nextExercise = row.value;
      }
      setCompleted(nextCompleted);
      setWaterMl(nextWater);
      setExerciseMin(nextExercise);

      const nextStreaks: Record<HabitType, number> = { bible_study: 0, prayer: 0, water: 0, exercise: 0 };
      const streakResults = await Promise.all(STREAK_TYPES.map((type) => getStreak(db, type)));
      STREAK_TYPES.forEach((type, i) => (nextStreaks[type] = streakResults[i]));
      setStreaks(nextStreaks);

      const nextWeek = {} as Record<HabitType, WeekDay[]>;
      const weekResults = await Promise.all(HABIT_TYPES.map((type) => getWeekCompletion(db, type)));
      HABIT_TYPES.forEach((type, i) => (nextWeek[type] = weekResults[i]));
      setWeek(nextWeek);
    } catch (error) {
      console.error('Failed to load habits', error);
    } finally {
      setLoading(false);
    }
  }, [db, date]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Each of these is fired directly from an onPress with no caller-side error
  // handling — without the catch, a tap that hits a DB error was an unhandled
  // rejection that silently did nothing, with no feedback that it failed.
  const toggle = useCallback(
    async (type: HabitType) => {
      try {
        await toggleHabit(db, type, date);
        await refresh();
      } catch (error) {
        console.error('Failed to toggle habit', error);
      }
    },
    [db, date, refresh]
  );

  const drinkWater = useCallback(async () => {
    try {
      await addWater(db, date, WATER_STEP_ML, waterGoalMl);
      await refresh();
    } catch (error) {
      console.error('Failed to log water', error);
    }
  }, [db, date, waterGoalMl, refresh]);

  const undoWater = useCallback(async () => {
    try {
      await addWater(db, date, -WATER_STEP_ML, waterGoalMl);
      await refresh();
    } catch (error) {
      console.error('Failed to undo water', error);
    }
  }, [db, date, waterGoalMl, refresh]);

  const exercise = useCallback(async () => {
    try {
      await addExercise(db, date, EXERCISE_STEP_MIN, exerciseGoalMin);
      await refresh();
    } catch (error) {
      console.error('Failed to log exercise', error);
    }
  }, [db, date, exerciseGoalMin, refresh]);

  // Dashboard quick-tick: one tap fully completes (or un-completes) the day's goal,
  // instead of requiring EXERCISE_GOAL_MIN/EXERCISE_STEP_MIN taps to cross the goal.
  const toggleExerciseDone = useCallback(async () => {
    try {
      const isDone = exerciseMin >= exerciseGoalMin;
      const delta = isDone ? -exerciseMin : exerciseGoalMin - exerciseMin;
      await addExercise(db, date, delta, exerciseGoalMin);
      await refresh();
    } catch (error) {
      console.error('Failed to toggle exercise', error);
    }
  }, [db, date, exerciseMin, exerciseGoalMin, refresh]);

  return {
    loading,
    completed,
    streaks,
    week,
    waterMl,
    waterGoalMl,
    waterStepMl: WATER_STEP_ML,
    exerciseMin,
    exerciseGoalMin,
    toggle,
    drinkWater,
    undoWater,
    exercise,
    toggleExerciseDone,
  };
}
