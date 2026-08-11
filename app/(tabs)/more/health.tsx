import React, { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { BookOpen, Dumbbell, Droplets, HeartHandshake, Minus, Pencil, Plus } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import {
  addExercise,
  addWater,
  getHabitsForDate,
  getWeekCompletion,
  HabitType,
  ML_PER_CUP,
  mlToCups,
  todayKey,
  WeekDay,
} from '@/database/habits';
import { getExerciseGoal, getWaterGoal, setExerciseGoal, setWaterGoal } from '@/database/wellnessGoals';
import { refreshHomeWidgets } from '@/services/widgetSync';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { PressableScale } from '@/components/ui/PressableScale';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { WaterBottle } from '@/components/ui/WaterBottle';
import { Body, Heading, Label } from '@/components/ui/Typography';

const WEEK_HABITS: { type: HabitType; label: string; Icon: typeof BookOpen }[] = [
  { type: 'bible_study', label: 'Bible Study', Icon: BookOpen },
  { type: 'prayer', label: 'Prayer', Icon: HeartHandshake },
  { type: 'water', label: 'Water', Icon: Droplets },
  { type: 'exercise', label: 'Exercise', Icon: Dumbbell },
];

export default function HealthScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const date = todayKey();

  const [waterMl, setWaterMl] = useState(0);
  const [waterGoal, setWaterGoalState] = useState(2000);
  const [exerciseMin, setExerciseMin] = useState(0);
  const [exerciseGoal, setExerciseGoalState] = useState(30);
  const [week, setWeek] = useState<Record<HabitType, WeekDay[]>>({
    bible_study: [],
    prayer: [],
    water: [],
    exercise: [],
  });
  const [editingGoal, setEditingGoal] = useState<'water' | 'exercise' | null>(null);
  const [goalInput, setGoalInput] = useState('');

  const refresh = useCallback(async () => {
    const [wGoal, eGoal, bibleWeek, prayerWeek, waterWeek, exerciseWeek] = await Promise.all([
      getWaterGoal(db),
      getExerciseGoal(db),
      getWeekCompletion(db, 'bible_study'),
      getWeekCompletion(db, 'prayer'),
      getWeekCompletion(db, 'water'),
      getWeekCompletion(db, 'exercise'),
    ]);
    setWaterGoalState(wGoal);
    setExerciseGoalState(eGoal);
    setWeek({ bible_study: bibleWeek, prayer: prayerWeek, water: waterWeek, exercise: exerciseWeek });

    // getWeekCompletion only reports completion, not raw value — fetch today's raw values separately.
    const rows = await getHabitsForDate(db, date);
    setWaterMl(rows.find((r) => r.habit_type === 'water')?.value ?? 0);
    setExerciseMin(rows.find((r) => r.habit_type === 'exercise')?.value ?? 0);
  }, [db, date]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleDrinkWater = async () => {
    const next = await addWater(db, date, 250, waterGoal);
    setWaterMl(next);
    refresh();
    refreshHomeWidgets();
  };

  const handleRemoveWater = async () => {
    const next = await addWater(db, date, -250, waterGoal);
    setWaterMl(next);
    refresh();
    refreshHomeWidgets();
  };

  const handleExercise = async () => {
    const next = await addExercise(db, date, 10, exerciseGoal);
    setExerciseMin(next);
    refresh();
    refreshHomeWidgets();
  };

  const openGoalEditor = (which: 'water' | 'exercise') => {
    setEditingGoal(which);
    setGoalInput(String(which === 'water' ? mlToCups(waterGoal) : exerciseGoal));
  };

  const saveGoal = async () => {
    const value = Number(goalInput);
    if (value > 0) {
      if (editingGoal === 'water') await setWaterGoal(db, value * ML_PER_CUP);
      else if (editingGoal === 'exercise') await setExerciseGoal(db, value);
      await refresh();
      refreshHomeWidgets();
    }
    setEditingGoal(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <AnimatedCard style={{ flex: 1, alignItems: 'center' }}>
            <Label style={{ marginBottom: theme.spacing.sm }}>Water Intake</Label>
            <WaterBottle progress={waterMl / waterGoal} size={80} />
            <Body style={{ fontFamily: theme.fontFamily.sansSemiBold, marginTop: theme.spacing.sm }}>
              {mlToCups(waterMl)} / {mlToCups(waterGoal)} cups
            </Body>
            <Label style={{ fontSize: 10, marginTop: 2 }}>4 cups = 1 L</Label>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.sm }}>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <PressableScale onPress={handleRemoveWater} disabled={waterMl <= 0}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: theme.radius.pill,
                      backgroundColor: theme.colors.surfaceMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: waterMl <= 0 ? 0.4 : 1,
                    }}
                  >
                    <Minus size={16} color={theme.colors.textMuted} strokeWidth={2.4} />
                  </View>
                </PressableScale>
                <Label style={{ fontSize: 10 }}>-1 cup</Label>
              </View>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <PressableScale onPress={handleDrinkWater}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: theme.radius.pill,
                      backgroundColor: theme.colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Plus size={16} color={theme.colors.onPrimary} strokeWidth={2.4} />
                  </View>
                </PressableScale>
                <Label style={{ fontSize: 10 }}>+1 cup</Label>
              </View>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <PressableScale onPress={() => openGoalEditor('water')}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: theme.radius.pill,
                      backgroundColor: theme.colors.surfaceMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Pencil size={14} color={theme.colors.textMuted} strokeWidth={1.75} />
                  </View>
                </PressableScale>
                <Label style={{ fontSize: 10 }}>Edit goal</Label>
              </View>
            </View>
          </AnimatedCard>

          <AnimatedCard delay={80} style={{ flex: 1, alignItems: 'center' }}>
            <Label style={{ marginBottom: theme.spacing.sm }}>Exercise</Label>
            <ProgressRing
              progress={exerciseMin / exerciseGoal}
              color={theme.colors.accent}
              trackColor={theme.colors.surfaceMuted}
              size={80}
              strokeWidth={8}
            >
              <Dumbbell size={20} color={theme.colors.accent} strokeWidth={1.75} />
            </ProgressRing>
            <Body style={{ fontFamily: theme.fontFamily.sansSemiBold, marginTop: theme.spacing.sm }}>
              {exerciseMin} / {exerciseGoal} min
            </Body>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.sm }}>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <PressableScale onPress={handleExercise}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: theme.radius.pill,
                      backgroundColor: theme.colors.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Plus size={16} color="#FFFFFF" strokeWidth={2.4} />
                  </View>
                </PressableScale>
                <Label style={{ fontSize: 10 }}>+10 min</Label>
              </View>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <PressableScale onPress={() => openGoalEditor('exercise')}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: theme.radius.pill,
                      backgroundColor: theme.colors.surfaceMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Pencil size={14} color={theme.colors.textMuted} strokeWidth={1.75} />
                  </View>
                </PressableScale>
                <Label style={{ fontSize: 10 }}>Edit goal</Label>
              </View>
            </View>
          </AnimatedCard>
        </View>

        <Label style={{ marginTop: theme.spacing.sm }}>This Week</Label>
        <Body style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm, marginTop: -theme.spacing.sm }}>
          A filled dot means that habit was completed on that day.
        </Body>
        {WEEK_HABITS.map(({ type, label, Icon }) => (
          <AnimatedCard key={type}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
              <Icon size={16} color={theme.colors.primary} strokeWidth={1.75} />
              <Body style={{ marginLeft: theme.spacing.xs, fontFamily: theme.fontFamily.sansSemiBold }}>{label}</Body>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {week[type].map((day) => (
                <View key={day.date} style={{ alignItems: 'center', gap: 4 }}>
                  <Label>{day.label}</Label>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: theme.radius.pill,
                      backgroundColor: day.completed ? theme.colors.success : theme.colors.surfaceMuted,
                    }}
                  />
                </View>
              ))}
            </View>
          </AnimatedCard>
        ))}
      </ScrollView>

      <Modal visible={editingGoal !== null} transparent animationType="fade" onRequestClose={() => setEditingGoal(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setEditingGoal(null)}
        >
          <Pressable
            style={{
              width: '80%',
              backgroundColor: theme.colors.background,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.lg,
              gap: theme.spacing.sm,
            }}
          >
            <Heading style={{ fontSize: theme.fontSize.md }}>
              {editingGoal === 'water' ? 'Daily water goal (cups)' : 'Daily exercise goal (min)'}
            </Heading>
            <TextInput
              autoFocus
              value={goalInput}
              onChangeText={setGoalInput}
              keyboardType="number-pad"
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.border,
                padding: theme.spacing.sm + 2,
                color: theme.colors.text,
                fontSize: theme.fontSize.lg,
              }}
            />
            <PressableScale onPress={saveGoal} scaleTo={0.98}>
              <View
                style={{
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.sm + 2,
                  alignItems: 'center',
                }}
              >
                <Body style={{ color: theme.colors.onPrimary, fontFamily: theme.fontFamily.sansSemiBold }}>Save</Body>
              </View>
            </PressableScale>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
