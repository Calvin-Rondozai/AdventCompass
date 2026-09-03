import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { MotiView } from 'moti';
import {
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Droplets,
  Dumbbell,
  Flame,
  HeartHandshake,
  Menu,
  Minus,
  Plus,
  X,
} from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { useDailyVerse } from '@/hooks/useDailyVerse';
import { useHabits } from '@/hooks/useHabits';
import { useSabbathGreeting } from '@/hooks/useSabbathGreeting';
import { formatLongDate, getTimeOfDay } from '@/utils/greeting';
import { getChapterADay } from '@/database/chapterADay';
import { getTodaysLesson, TodaysLesson } from '@/database/sabbathSchool';
import { getLocalizedBookName } from '@/database/bookNames';
import { useBibleTranslation } from '@/hooks/useBibleTranslation';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { PressableScale } from '@/components/ui/PressableScale';
import { WaterBottle } from '@/components/ui/WaterBottle';
import { DashboardHeroArt } from '@/components/ui/DashboardHeroArt';
import { ConfettiBurst } from '@/components/ui/ConfettiBurst';
import { Body, Heading, Label, ScriptureQuote } from '@/components/ui/Typography';
import { AddScheduleItemSheet } from '@/components/ui/AddScheduleItemSheet';
import { WeeklySummaryModal } from '@/components/ui/WeeklySummaryModal';
import { getScheduleIcon } from '@/components/ui/ScheduleIconPicker';
import { mlToCups } from '@/database/habits';
import type { HabitType } from '@/database/habits';

// bible_study/prayer are simple done-or-not toggles; exercise instead adds a fixed
// step (same increment as the Health screen) since its 'completed' means value >= goal.
// Every goal's icon badge uses the same blue — completion is shown by the checkmark
// circle at the end of the row instead.
const GOALS: { type: HabitType; label: string; Icon: typeof BookOpen; mode: 'toggle' | 'increment' }[] = [
  { type: 'bible_study', label: 'Bible Study', Icon: BookOpen, mode: 'toggle' },
  { type: 'prayer', label: 'Prayer', Icon: HeartHandshake, mode: 'toggle' },
  { type: 'exercise', label: 'Workout', Icon: Dumbbell, mode: 'increment' },
];

const WEEK_SUMMARY: { type: HabitType; label: string; Icon: typeof BookOpen }[] = [
  { type: 'bible_study', label: 'Bible Study', Icon: BookOpen },
  { type: 'prayer', label: 'Prayer', Icon: HeartHandshake },
  { type: 'exercise', label: 'Workout', Icon: Dumbbell },
  { type: 'water', label: 'Water', Icon: Droplets },
];

const WEEK_LABEL_COLUMN_WIDTH = 14 + 4 + 84; // icon width + theme.spacing.xs gap + label width, kept in sync with the rows below

export default function HomeDashboard() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { translation } = useBibleTranslation();
  const verse = useDailyVerse();
  const habits = useHabits();
  const [burst, setBurst] = React.useState<{ type: HabitType | string; nonce: number } | null>(null);
  const [todaysLesson, setTodaysLesson] = useState<TodaysLesson | null>(null);
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const chapterOfDay = getChapterADay();
  const greeting = useSabbathGreeting();
  const weekDays = habits.week.bible_study.length === 7 ? habits.week.bible_study : [];

  // useFocusEffect (not a plain effect) so downloading a new quarterly from the Sabbath
  // School screen and returning to Home picks up today's lesson immediately, instead of
  // only on the next cold app start.
  useFocusEffect(
    useCallback(() => {
      getTodaysLesson(db).then(setTodaysLesson);
    }, [db])
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: theme.spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.lg }}>
            <PressableScale onPress={() => router.push('/more')}>
              <Menu size={22} color={theme.colors.text} strokeWidth={1.75} />
            </PressableScale>
            <PressableScale onPress={() => router.push('/more/notifications')}>
              <View>
                <Bell size={22} color={theme.colors.text} strokeWidth={1.75} />
                <View
                  style={{
                    position: 'absolute',
                    top: -1,
                    right: -1,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: theme.colors.danger,
                    borderWidth: 1.5,
                    borderColor: theme.colors.background,
                  }}
                />
              </View>
            </PressableScale>
          </View>
          <MotiView
            from={{ opacity: 0, translateY: -12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: theme.motion.base }}
            style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}
          >
            <View style={{ flex: 1, marginRight: theme.spacing.sm }}>
              <Heading style={{ fontSize: theme.fontSize.xxl }}>{greeting}</Heading>
              <Body style={{ color: theme.colors.textFaint, fontSize: theme.fontSize.xs, marginTop: 4 }}>
                {formatLongDate()}
              </Body>
            </View>
            <DashboardHeroArt timeOfDay={getTimeOfDay()} size={104} />
          </MotiView>
        </View>

        <View style={{ paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.sm, gap: theme.spacing.md }}>
          {/* Daily verse — pulled up to overlap the hero art slightly, like the reference */}
          <AnimatedCard delay={80} style={{ marginTop: -theme.spacing.md }}>
            <Text
              style={{
                fontFamily: theme.fontFamily.serifSemiBold,
                fontSize: 40,
                lineHeight: 40,
                color: theme.colors.accent,
                marginBottom: -4,
              }}
            >
              “
            </Text>
            {verse ? (
              <>
                <ScriptureQuote>“{verse.text}”</ScriptureQuote>
                <PressableScale
                  onPress={() =>
                    router.push({ pathname: '/bible/[book]/[chapter]', params: { book: verse.book, chapter: String(verse.chapter) } })
                  }
                  scaleTo={0.97}
                  style={{ alignSelf: 'flex-start', marginTop: theme.spacing.sm }}
                >
                  <Body style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}>
                    {verse.book} {verse.chapter}:{verse.verse}
                  </Body>
                </PressableScale>
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
              <CalendarDays size={28} color={theme.colors.primary} strokeWidth={1.75} />
              <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                <Label>Today's Plan</Label>
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
              <AnimatedCard delay={130} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <BookOpen size={28} color={theme.colors.accent} strokeWidth={1.75} />
                <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                  <Label style={{ color: theme.colors.accent }}>Sabbath School: Lesson {todaysLesson.week}</Label>
                  <Body style={{ fontFamily: theme.fontFamily.sansSemiBold, marginTop: 2 }} numberOfLines={1}>
                    {todaysLesson.dayTitle}
                  </Body>
                  <Body style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm, marginTop: 2 }} numberOfLines={1}>
                    {todaysLesson.lessonTitle}
                  </Body>
                </View>
                <ChevronRight size={18} color={theme.colors.textFaint} />
              </AnimatedCard>
            </PressableScale>
          )}

          {/* Today's goals */}
          <AnimatedCard delay={160}>
            <Label style={{ marginBottom: theme.spacing.sm }}>Today's Schedule</Label>
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
                      if (mode === 'increment') habits.toggleExerciseDone();
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
                        backgroundColor: theme.colors.surfaceMuted,
                      }}
                    >
                      <Icon size={24} color={theme.colors.primary} strokeWidth={2} />
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
              {habits.customHabits.map((item) => {
                const isDone = habits.completed[item.id];
                const streak = habits.streaks[item.id];
                const Icon = getScheduleIcon(item.icon);
                return (
                  <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                    <PressableScale
                      onPress={() => {
                        if (!isDone) {
                          const nonce = Date.now();
                          setBurst({ type: item.id, nonce });
                          setTimeout(() => setBurst((b) => (b?.nonce === nonce ? null : b)), 900);
                        }
                        habits.toggle(item.id);
                      }}
                      scaleTo={0.98}
                      style={{ flex: 1 }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: theme.spacing.sm,
                          borderRadius: theme.radius.md,
                          backgroundColor: theme.colors.surfaceMuted,
                        }}
                      >
                        <Icon size={24} color={theme.colors.primary} strokeWidth={2} />
                        <Body style={{ flex: 1, marginLeft: theme.spacing.sm, fontFamily: theme.fontFamily.sansMedium }} numberOfLines={1}>
                          {item.label}
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
                          <ConfettiBurst key={burst?.type === item.id ? burst.nonce : 'idle'} active={burst?.type === item.id} />
                        </MotiView>
                      </View>
                    </PressableScale>
                    <PressableScale onPress={() => habits.removeCustomScheduleItem(item.id)} scaleTo={0.85}>
                      <View style={{ padding: theme.spacing.xs }}>
                        <X size={16} color={theme.colors.textFaint} strokeWidth={2} />
                      </View>
                    </PressableScale>
                  </View>
                );
              })}
              <PressableScale onPress={() => setAddSheetVisible(true)} scaleTo={0.98}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: theme.spacing.sm,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderStyle: 'dashed',
                    gap: theme.spacing.xs,
                  }}
                >
                  <Plus size={16} color={theme.colors.textMuted} strokeWidth={2} />
                  <Body style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamily.sansMedium, fontSize: theme.fontSize.sm }}>
                    Add to schedule
                  </Body>
                </View>
              </PressableScale>
            </View>
          </AnimatedCard>

          {/* Water tracker */}
          <AnimatedCard delay={200}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Droplets size={28} color={theme.colors.primary} strokeWidth={1.75} />
              <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                <Label>Water Intake</Label>
                <Heading style={{ fontSize: theme.fontSize.lg, marginTop: 2 }}>
                  {mlToCups(habits.waterMl)}
                  <Body style={{ color: theme.colors.textMuted }}> / {mlToCups(habits.waterGoalMl)} cups</Body>
                </Heading>
                <Body style={{ color: theme.colors.textFaint, fontSize: theme.fontSize.xs, marginTop: 2 }}>
                  Keep it up! You can do it.
                </Body>
              </View>
              <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
                <WaterBottle progress={habits.waterMl / habits.waterGoalMl} size={72} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <PressableScale onPress={() => habits.drinkWater()}>
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: theme.radius.pill,
                        backgroundColor: theme.colors.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Plus size={15} color={theme.colors.onPrimary} strokeWidth={2.4} />
                    </View>
                  </PressableScale>
                  <PressableScale onPress={() => habits.undoWater()} disabled={habits.waterMl <= 0}>
                    <Body
                      style={{
                        color: theme.colors.textFaint,
                        fontSize: theme.fontSize.xs,
                        opacity: habits.waterMl <= 0 ? 0.4 : 1,
                      }}
                    >
                      <Minus size={10} color={theme.colors.textFaint} strokeWidth={2.4} /> undo
                    </Body>
                  </PressableScale>
                </View>
              </View>
            </View>
          </AnimatedCard>

          {/* Weekly summary */}
          <AnimatedCard delay={240}>
            <Label style={{ marginBottom: theme.spacing.sm }}>This Week</Label>
            {weekDays.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.xs }}>
                <View style={{ width: WEEK_LABEL_COLUMN_WIDTH }} />
                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
                  {weekDays.map((day) => (
                    <Body
                      key={day.date}
                      style={{ width: 18, textAlign: 'center', fontSize: theme.fontSize.xs, color: theme.colors.textFaint }}
                    >
                      {day.label}
                    </Body>
                  ))}
                </View>
              </View>
            )}
            <View style={{ gap: theme.spacing.sm }}>
              {WEEK_SUMMARY.map(({ type, label, Icon }) => (
                <View key={type} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon size={14} color={theme.colors.textMuted} strokeWidth={1.75} />
                  <Body style={{ width: 84, marginLeft: theme.spacing.xs, fontSize: theme.fontSize.xs }} numberOfLines={1}>
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
                          backgroundColor: day.completed ? theme.colors.success : 'transparent',
                          borderWidth: day.completed ? 0 : 1.5,
                          borderColor: theme.colors.border,
                        }}
                      />
                    ))}
                  </View>
                </View>
              ))}
              {habits.customHabits.map((item) => {
                const Icon = getScheduleIcon(item.icon);
                return (
                  <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Icon size={14} color={theme.colors.textMuted} strokeWidth={1.75} />
                    <Body style={{ width: 84, marginLeft: theme.spacing.xs, fontSize: theme.fontSize.xs }} numberOfLines={1}>
                      {item.label}
                    </Body>
                    <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
                      {(habits.week[item.id] ?? []).map((day) => (
                        <View
                          key={day.date}
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: theme.radius.pill,
                            backgroundColor: day.completed ? theme.colors.success : 'transparent',
                            borderWidth: day.completed ? 0 : 1.5,
                            borderColor: theme.colors.border,
                          }}
                        />
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          </AnimatedCard>

          {/* Devotional teaser */}
          <PressableScale onPress={() => router.push('/more/devotional')} scaleTo={0.98}>
            <AnimatedCard delay={320} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <HeartHandshake size={28} color={theme.colors.accent} strokeWidth={1.75} />
              <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }}>Devotional</Body>
                <Body style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
                  Let's grow closer to God, every day.
                </Body>
              </View>
              <ChevronRight size={18} color={theme.colors.textFaint} />
            </AnimatedCard>
          </PressableScale>
        </View>
      </ScrollView>

      <AddScheduleItemSheet
        visible={addSheetVisible}
        onClose={() => setAddSheetVisible(false)}
        onAdd={(label, icon) => habits.addCustomScheduleItem(label, icon)}
      />
      <WeeklySummaryModal stats={habits.weeklySummary} onClose={habits.dismissWeeklySummary} />
    </SafeAreaView>
  );
}
