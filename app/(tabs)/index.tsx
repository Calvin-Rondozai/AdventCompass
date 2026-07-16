import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { MotiView } from 'moti';
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Droplets,
  Dumbbell,
  Flame,
  HeartHandshake,
  Minus,
  Moon,
  Plus,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
} from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { useDailyVerse } from '@/hooks/useDailyVerse';
import { useHabits } from '@/hooks/useHabits';
import { getGreeting, getTimeOfDay, formatLongDate } from '@/utils/greeting';
import { getChapterADay } from '@/database/chapterADay';
import { getTodaysLesson, TodaysLesson } from '@/database/sabbathSchool';
import { getLocalizedBookName } from '@/database/bookNames';
import { useBibleTranslation } from '@/hooks/useBibleTranslation';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { PressableScale } from '@/components/ui/PressableScale';
import { WaterBottle } from '@/components/ui/WaterBottle';
import { ConfettiBurst } from '@/components/ui/ConfettiBurst';
import { NightSky } from '@/components/ui/NightSky';
import { Body, Heading, Label, ScriptureQuote } from '@/components/ui/Typography';
import { mlToCups } from '@/database/habits';
import type { HabitType } from '@/database/habits';

// bible_study/prayer are simple done-or-not toggles; exercise instead adds a fixed
// step (same increment as the Health screen) since its 'completed' means value >= goal.
const GOALS: { type: HabitType; label: string; Icon: typeof BookOpen; mode: 'toggle' | 'increment' }[] = [
  { type: 'bible_study', label: 'Bible Study', Icon: BookOpen, mode: 'toggle' },
  { type: 'prayer', label: 'Prayer', Icon: HeartHandshake, mode: 'toggle' },
  { type: 'exercise', label: 'Exercise', Icon: Dumbbell, mode: 'increment' },
];

const WEEK_SUMMARY: { type: HabitType; label: string; Icon: typeof BookOpen }[] = [
  { type: 'bible_study', label: 'Bible', Icon: BookOpen },
  { type: 'prayer', label: 'Prayer', Icon: HeartHandshake },
  { type: 'water', label: 'Water', Icon: Droplets },
  { type: 'exercise', label: 'Exercise', Icon: Dumbbell },
];

function TimeOfDayIcon({ color }: { color: string }) {
  switch (getTimeOfDay()) {
    case 'night':
      return <Moon size={22} color={color} strokeWidth={1.75} />;
    case 'morning':
      return <Sunrise size={22} color={color} strokeWidth={1.75} />;
    case 'afternoon':
      return <Sun size={22} color={color} strokeWidth={1.75} />;
    case 'evening':
      return <Sunset size={22} color={color} strokeWidth={1.75} />;
  }
}

export default function HomeDashboard() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { translation } = useBibleTranslation();
  const verse = useDailyVerse();
  const habits = useHabits();
  const [burst, setBurst] = React.useState<{ type: HabitType; nonce: number } | null>(null);
  const [todaysLesson, setTodaysLesson] = useState<TodaysLesson | null>(null);
  const chapterOfDay = getChapterADay();
  const isNight = getTimeOfDay() === 'night';

  useEffect(() => {
    getTodaysLesson(db).then(setTodaysLesson);
  }, [db]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: theme.spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={theme.colors.gradientHero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing.xxl,
            borderBottomLeftRadius: theme.radius.xl,
            borderBottomRightRadius: theme.radius.xl,
            overflow: 'hidden',
          }}
        >
          {isNight && <NightSky />}
          <MotiView
            from={{ opacity: 0, translateY: -12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: theme.motion.base }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <View>
              <Label style={{ color: 'rgba(255,255,255,0.7)' }}>{formatLongDate()}</Label>
              <Heading style={{ color: '#FFFFFF', fontSize: theme.fontSize.xxl, marginTop: 4 }}>
                {getGreeting()}
              </Heading>
            </View>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: theme.radius.md,
                backgroundColor: 'rgba(255,255,255,0.16)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TimeOfDayIcon color="#FFFFFF" />
            </View>
          </MotiView>
        </LinearGradient>

        <View style={{ paddingHorizontal: theme.spacing.lg, marginTop: -theme.spacing.xl, gap: theme.spacing.md }}>
          {/* Daily verse */}
          <AnimatedCard delay={80}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: theme.spacing.sm }}>
              <Sparkles size={16} color={theme.colors.accent} strokeWidth={2} />
              <Label style={{ color: theme.colors.accent }}>Today’s Verse</Label>
            </View>
            {verse ? (
              <>
                <ScriptureQuote>“{verse.text}”</ScriptureQuote>
                <Body style={{ color: theme.colors.textMuted, marginTop: theme.spacing.sm }}>
                  {verse.book} {verse.chapter}:{verse.verse}
                </Body>
              </>
            ) : (
              <Body style={{ color: theme.colors.textMuted }}>Loading today’s verse…</Body>
            )}
          </AnimatedCard>

          {/* Chapter-a-Day */}
          <PressableScale
            onPress={() => router.push({ pathname: '/bible/[book]/[chapter]', params: { book: chapterOfDay.book, chapter: String(chapterOfDay.chapter) } })}
            scaleTo={0.98}
          >
            <AnimatedCard delay={100} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CalendarDays size={20} color={theme.colors.primary} strokeWidth={1.75} />
              </View>
              <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                <Label>Today's Chapter</Label>
                <Body style={{ fontFamily: theme.fontFamily.sansSemiBold, marginTop: 2 }}>
                  {getLocalizedBookName(translation, chapterOfDay.book)} {chapterOfDay.chapter}
                </Body>
              </View>
              <ChevronRight size={18} color={theme.colors.textFaint} />
            </AnimatedCard>
          </PressableScale>

          {/* Sabbath School lesson of the day */}
          {todaysLesson && (
            <PressableScale
              onPress={() =>
                router.push({
                  pathname: '/more/sabbath-school/[id]/[week]',
                  params: { id: todaysLesson.quarterId, week: String(todaysLesson.week), day: String(todaysLesson.day) },
                })
              }
              scaleTo={0.98}
            >
              <AnimatedCard delay={130}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: theme.spacing.sm }}>
                  <BookOpen size={16} color={theme.colors.accent} strokeWidth={2} />
                  <Label style={{ color: theme.colors.accent }}>Sabbath School: Lesson {todaysLesson.week}</Label>
                </View>
                <Heading style={{ fontSize: theme.fontSize.lg }}>{todaysLesson.dayTitle}</Heading>
                <Body style={{ color: theme.colors.textMuted, marginTop: theme.spacing.sm }}>{todaysLesson.lessonTitle}</Body>
              </AnimatedCard>
            </PressableScale>
          )}

          {/* Today's goals */}
          <AnimatedCard delay={160}>
            <Label style={{ marginBottom: theme.spacing.sm }}>Your Daily Goals</Label>
            <View style={{ gap: theme.spacing.sm }}>
              {GOALS.map(({ type, label, Icon, mode }) => {
                const isDone = habits.completed[type];
                const streak = habits.streaks[type];
                return (
                  <PressableScale
                    key={type}
                    onPress={() => {
                      if (!isDone) {
                        const nonce = Date.now();
                        setBurst({ type, nonce });
                        setTimeout(() => setBurst((b) => (b?.nonce === nonce ? null : b)), 900);
                      }
                      if (mode === 'increment') habits.exercise();
                      else habits.toggle(type);
                    }}
                    scaleTo={0.98}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: theme.spacing.sm,
                        borderRadius: theme.radius.md,
                        backgroundColor: isDone ? theme.colors.successSoft : theme.colors.surfaceMuted,
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: theme.radius.sm,
                          backgroundColor: isDone ? theme.colors.success : theme.colors.surface,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon size={18} color={isDone ? '#FFFFFF' : theme.colors.primary} strokeWidth={2} />
                      </View>
                      <Body style={{ flex: 1, marginLeft: theme.spacing.sm, fontFamily: theme.fontFamily.sansMedium }}>
                        {label}
                      </Body>
                      {streak > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: theme.spacing.sm }}>
                          <Flame size={14} color={theme.colors.accent} strokeWidth={2} />
                          <Body style={{ fontSize: theme.fontSize.xs, color: theme.colors.accent }}>{streak}</Body>
                        </View>
                      )}
                      <MotiView
                        animate={{
                          backgroundColor: isDone ? theme.colors.success : 'transparent',
                          borderColor: isDone ? theme.colors.success : theme.colors.border,
                        }}
                        transition={{ type: 'timing', duration: theme.motion.fast }}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: theme.radius.pill,
                          borderWidth: 2,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isDone && (
                          <MotiView
                            from={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', damping: 10 }}
                          >
                            <Check size={14} color="#FFFFFF" strokeWidth={3} />
                          </MotiView>
                        )}
                        <ConfettiBurst key={burst?.type === type ? burst.nonce : 'idle'} active={burst?.type === type} />
                      </MotiView>
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </AnimatedCard>

          {/* Water tracker */}
          <AnimatedCard delay={200}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <WaterBottle progress={habits.waterMl / habits.waterGoalMl} size={72} />
              <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                <Label>Water Intake</Label>
                <Heading style={{ fontSize: theme.fontSize.lg, marginTop: 2 }}>
                  {mlToCups(habits.waterMl)}
                  <Body style={{ color: theme.colors.textMuted }}> / {mlToCups(habits.waterGoalMl)} cups</Body>
                </Heading>
                <Body style={{ color: theme.colors.textFaint, fontSize: theme.fontSize.xs, marginTop: 2 }}>
                  1 cup ≈ 250ml · 4 cups = 1 L
                </Body>
              </View>
              <View style={{ gap: theme.spacing.xs }}>
                <PressableScale onPress={() => habits.drinkWater()}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: theme.radius.pill,
                      backgroundColor: theme.colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Plus size={18} color={theme.colors.onPrimary} strokeWidth={2.4} />
                  </View>
                </PressableScale>
                <PressableScale onPress={() => habits.undoWater()} disabled={habits.waterMl <= 0}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: theme.radius.pill,
                      backgroundColor: theme.colors.surfaceMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: habits.waterMl <= 0 ? 0.4 : 1,
                    }}
                  >
                    <Minus size={18} color={theme.colors.textMuted} strokeWidth={2.4} />
                  </View>
                </PressableScale>
              </View>
            </View>
          </AnimatedCard>

          {/* Weekly summary */}
          <AnimatedCard delay={240}>
            <Label style={{ marginBottom: theme.spacing.sm }}>This Week</Label>
            <View style={{ gap: theme.spacing.sm }}>
              {WEEK_SUMMARY.map(({ type, label, Icon }) => (
                <View key={type} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon size={14} color={theme.colors.textMuted} strokeWidth={1.75} />
                  <Body style={{ width: 60, marginLeft: theme.spacing.xs, fontSize: theme.fontSize.sm }}>
                    {label}
                  </Body>
                  <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
                    {habits.week[type].map((day) => (
                      <View
                        key={day.date}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: theme.radius.pill,
                          backgroundColor: day.completed ? theme.colors.success : theme.colors.surfaceMuted,
                        }}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </AnimatedCard>

          {/* Devotional teaser */}
          <PressableScale onPress={() => router.push('/more/devotional')} scaleTo={0.98}>
            <AnimatedCard delay={320} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={20} color={theme.colors.accent} strokeWidth={1.75} />
              </View>
              <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }}>Devotions</Body>
                <Body style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
                  Today's devotional & prayer prompts
                </Body>
              </View>
              <ChevronRight size={18} color={theme.colors.textFaint} />
            </AnimatedCard>
          </PressableScale>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
