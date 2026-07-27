import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Check, ChevronRight, Trash2 } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getReadingPlan, ReadingPlan } from '@/database/readingPlans';
import { deleteCustomPlan, getCustomPlans } from '@/database/customReadingPlans';
import { getKv, setKv } from '@/database/kv';
import { PageLoader } from '@/components/ui/PageLoader';
import { PressableScale } from '@/components/ui/PressableScale';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TrophyCelebration } from '@/components/ui/TrophyCelebration';
import { Body, Heading, Label } from '@/components/ui/Typography';

export default function ReadingPlanDetailScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const isCustom = (planId ?? '').startsWith('custom-');
  const [plan, setPlan] = useState<ReadingPlan | undefined>(() => getReadingPlan(planId ?? ''));
  const kvKey = `reading_plan_${planId}_done`;

  const [done, setDone] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isCustom) {
      getCustomPlans(db).then((plans) => setPlan(plans.find((p) => p.id === planId)));
    }
  }, [db, isCustom, planId]);

  useEffect(() => {
    getKv(db, kvKey).then((value) => {
      if (value) {
        try {
          setDone(new Set(JSON.parse(value)));
        } catch {
          // ignore corrupt value
        }
      }
    });
  }, [db, kvKey]);

  const handleDelete = useCallback(async () => {
    if (!planId) return;
    await deleteCustomPlan(db, planId);
    router.back();
  }, [db, planId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: plan?.title ?? '',
      headerRight: isCustom
        ? () => (
            <PressableScale onPress={handleDelete} style={{ padding: theme.spacing.xs }}>
              <Trash2 size={20} color={theme.colors.danger} strokeWidth={1.75} />
            </PressableScale>
          )
        : undefined,
    });
  }, [navigation, plan, isCustom, handleDelete, theme]);

  const [celebrate, setCelebrate] = useState(false);

  const toggleDay = useCallback(
    (day: number) => {
      setDone((prev) => {
        const next = new Set(prev);
        if (next.has(day)) next.delete(day);
        else next.add(day);
        setKv(db, kvKey, JSON.stringify([...next])).catch(() => {});
        if (plan && next.size === plan.days.length && prev.size < plan.days.length) {
          setCelebrate(true);
          setTimeout(() => setCelebrate(false), 2400);
        }
        return next;
      });
    },
    [db, kvKey, plan]
  );

  if (!plan) return <PageLoader />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <View style={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.sm }}>
        <Body style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.sm }}>{plan.description}</Body>
        <ProgressBar
          progress={done.size / plan.days.length}
          color={theme.colors.primary}
          trackColor={theme.colors.surfaceMuted}
        />
        <Label style={{ marginTop: theme.spacing.xs }}>
          {done.size} / {plan.days.length} days complete
        </Label>
      </View>

      <FlatList
        data={plan.days}
        keyExtractor={(item) => String(item.day)}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, paddingBottom: theme.spacing.xxl }}
        renderItem={({ item }) => {
          const isDone = done.has(item.day);
          const chapterLabel =
            item.chapters.length === 1 ? `${item.book} ${item.chapters[0]}` : `${item.book} ${item.chapters[0]}-${item.chapters[item.chapters.length - 1]}`;
          return (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.border,
                padding: theme.spacing.sm + 2,
                marginBottom: theme.spacing.xs + 2,
              }}
            >
              <PressableScale onPress={() => toggleDay(item.day)} scaleTo={0.85}>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: theme.radius.pill,
                    borderWidth: 2,
                    borderColor: isDone ? theme.colors.success : theme.colors.border,
                    backgroundColor: isDone ? theme.colors.success : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isDone && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                </View>
              </PressableScale>
              <PressableScale
                onPress={() =>
                  router.push({
                    pathname: '/bible/[book]/[chapter]',
                    params: { book: item.book, chapter: String(item.chapters[0]) },
                  })
                }
                scaleTo={0.99}
                style={{ flex: 1 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: theme.spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Label>Day {item.day}</Label>
                    <Body style={{ fontFamily: theme.fontFamily.sansMedium, marginTop: 2 }}>{chapterLabel}</Body>
                  </View>
                  <ChevronRight size={16} color={theme.colors.textFaint} />
                </View>
              </PressableScale>
            </View>
          );
        }}
      />
      <TrophyCelebration active={celebrate} />
    </SafeAreaView>
  );
}
