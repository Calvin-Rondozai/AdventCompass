import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  addCustomHabit as addCustomHabitRow,
  addExercise,
  addWater,
  archiveCustomHabit,
  CustomHabit,
  EXERCISE_GOAL_MIN,
  EXERCISE_STEP_MIN,
  getHabitsForDate,
  getStreak,
  getWeekCompletion,
  getWeeklySummaryIfDue,
  HabitType,
  listCustomHabits,
  todayKey,
  toggleHabit,
  WATER_GOAL_ML,
  WATER_STEP_ML,
  WeekDay,
  WeeklySummaryStat,
} from '@/database/habits';
import { getExerciseGoal, getWaterGoal } from '@/database/wellnessGoals';
import { refreshHomeWidgets } from '@/services/widgetSync';
import type { ScheduleIconName } from '@/components/ui/ScheduleIconPicker';

const STREAK_TYPES: HabitType[] = ['bible_study', 'prayer', 'exercise'];
const HABIT_TYPES: HabitType[] = ['bible_study', 'prayer', 'water', 'exercise'];

const WEEKLY_SUMMARY_LABELS: Record<HabitType, string> = {
  bible_study: 'Bible Study',
  prayer: 'Prayer',
  water: 'Water',
  exercise: 'Workout',
};
const WEEKLY_SUMMARY_ICONS: Record<HabitType, string> = {
  bible_study: 'BookOpen',
  prayer: 'HeartHandshake',
  water: 'Droplets',
  exercise: 'Dumbbell',
};

export function useHabits() {
  const db = useSQLiteContext();
  const [date] = useState(() => todayKey());
  const [completed, setCompleted] = useState<Record<string, boolean>>({
    bible_study: false,
    prayer: false,
    water: false,
    exercise: false,
  });
  const [waterMl, setWaterMl] = useState(0);
  const [waterGoalMl, setWaterGoalMl] = useState(WATER_GOAL_ML);
  const [exerciseMin, setExerciseMin] = useState(0);
  const [exerciseGoalMin, setExerciseGoalMin] = useState(EXERCISE_GOAL_MIN);
  const [streaks, setStreaks] = useState<Record<string, number>>({
    bible_study: 0,
    prayer: 0,
    water: 0,
    exercise: 0,
  });
  const [week, setWeek] = useState<Record<string, WeekDay[]>>({
    bible_study: [],
    prayer: [],
    water: [],
    exercise: [],
  });
  const [customHabits, setCustomHabits] = useState<CustomHabit[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummaryStat[] | null>(null);
  const [loading, setLoading] = useState(true);

  // This is the home tab's data source, so an unhandled rejection here (a real
  // possibility — SQLite errors are not theoretical) would leave `loading` stuck
  // true forever with no error shown; the try/finally guarantees the spinner always
  // resolves one way or another even if a query fails.
  const refresh = useCallback(async () => {
    try {
      const [rows, wGoal, eGoal, customList] = await Promise.all([
        getHabitsForDate(db, date),
        getWaterGoal(db),
        getExerciseGoal(db),
        listCustomHabits(db),
      ]);
      setWaterGoalMl(wGoal);
      setExerciseGoalMin(eGoal);
      setCustomHabits(customList);

      const customIds = customList.map((c) => c.id);
      const allHabitTypes: string[] = [...HABIT_TYPES, ...customIds];
      const allStreakTypes: string[] = [...STREAK_TYPES, ...customIds];

      const nextCompleted: Record<string, boolean> = {
        bible_study: false,
        prayer: false,
        water: false,
        exercise: false,
      };
      customIds.forEach((id) => (nextCompleted[id] = false));
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

      const nextStreaks: Record<string, number> = {};
      const streakResults = await Promise.all(allStreakTypes.map((type) => getStreak(db, type)));
      allStreakTypes.forEach((type, i) => (nextStreaks[type] = streakResults[i]));
      setStreaks(nextStreaks);

      const nextWeek: Record<string, WeekDay[]> = {};
      const weekResults = await Promise.all(allHabitTypes.map((type) => getWeekCompletion(db, type)));
      allHabitTypes.forEach((type, i) => (nextWeek[type] = weekResults[i]));
      setWeek(nextWeek);

      const summaryTypes = [
        ...HABIT_TYPES.map((type) => ({ type, label: WEEKLY_SUMMARY_LABELS[type], icon: WEEKLY_SUMMARY_ICONS[type] })),
        ...customList.map((c) => ({ type: c.id, label: c.label, icon: c.icon })),
      ];
      const dueSummary = await getWeeklySummaryIfDue(db, summaryTypes);
      if (dueSummary) setWeeklySummary(dueSummary);
    } catch (error) {
      console.error('Failed to load habits', error);
    } finally {
      setLoading(false);
    }
  }, [db, date]);

  const addCustomScheduleItem = useCallback(
    async (label: string, icon: ScheduleIconName) => {
      try {
        await addCustomHabitRow(db, label, icon);
        await refresh();
      } catch (error) {
        console.error('Failed to add custom schedule item', error);
      }
    },
    [db, refresh]
  );

  const removeCustomScheduleItem = useCallback(
    async (id: string) => {
      try {
        await archiveCustomHabit(db, id);
        await refresh();
      } catch (error) {
        console.error('Failed to remove custom schedule item', error);
      }
    },
    [db, refresh]
  );

  const dismissWeeklySummary = useCallback(() => setWeeklySummary(null), []);

  // useFocusEffect (not useEffect) so a goal change made on the Health screen — or any
  // other water/exercise log elsewhere — is picked up the moment the Home tab regains
  // focus, instead of only ever refreshing once on this hook's initial mount.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Each of these is fired directly from an onPress with no caller-side error
  // handling — without the catch, a tap that hits a DB error was an unhandled
  // rejection that silently did nothing, with no feedback that it failed.
  const toggle = useCallback(
    async (type: HabitType | string) => {
      try {
        await toggleHabit(db, type, date);
        await refresh();
        refreshHomeWidgets();
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
    customHabits,
    addCustomScheduleItem,
    removeCustomScheduleItem,
    weeklySummary,
    dismissWeeklySummary,
  };
}
