import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { BookOpen, CheckCircle2, ChevronRight, Plus, Sparkles } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { READING_PLANS, ReadingPlan } from '@/database/readingPlans';
import { getCustomPlans } from '@/database/customReadingPlans';
import { getActiveReadingPlanId, setActiveReadingPlanId } from '@/database/activeReadingPlan';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Label } from '@/components/ui/Typography';

export default function ReadingPlansScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const [customPlans, setCustomPlans] = useState<ReadingPlan[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getCustomPlans(db).then(setCustomPlans);
      getActiveReadingPlanId(db).then(setActiveId);
    }, [db])
  );

  const selectAsVerseSource = (id: string | null) => {
    // Toggle off back to "Whole Bible" if the same plan is tapped again.
    const next = id === activeId ? null : id;
    setActiveId(next);
    setActiveReadingPlanId(db, next).catch(() => {});
  };

  const renderRadio = (selected: boolean) => (
    <CheckCircle2
      size={22}
      color={selected ? theme.colors.primary : theme.colors.textFaint}
      fill={selected ? theme.colors.primary : undefined}
      strokeWidth={1.75}
    />
  );

  const renderPlan = (plan: ReadingPlan) => {
    const selected = activeId === plan.id;
    return (
      <View
        key={plan.id}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.sm,
        }}
      >
        <PressableScale
          onPress={() => router.push({ pathname: '/more/reading-plans/[planId]', params: { planId: plan.id } })}
          scaleTo={0.99}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: theme.radius.sm,
              backgroundColor: theme.colors.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BookOpen size={18} color={theme.colors.primary} strokeWidth={1.75} />
          </View>
          <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
            <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }}>{plan.title}</Body>
            <Label style={{ marginTop: 2 }}>{plan.description}</Label>
          </View>
          <ChevronRight size={18} color={theme.colors.textFaint} />
        </PressableScale>
        <PressableScale onPress={() => selectAsVerseSource(plan.id)} scaleTo={0.85} style={{ paddingLeft: theme.spacing.sm }}>
          {renderRadio(selected)}
        </PressableScale>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <PressableScale onPress={() => router.push('/more/reading-plans/new')} scaleTo={0.98}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.xs,
              backgroundColor: theme.colors.primarySoft,
              borderRadius: theme.radius.md,
              padding: theme.spacing.sm + 2,
              marginBottom: theme.spacing.md,
            }}
          >
            <Plus size={18} color={theme.colors.primary} />
            <Body style={{ color: theme.colors.primary, fontFamily: theme.fontFamily.sansSemiBold }}>
              Create Your Own Plan
            </Body>
          </View>
        </PressableScale>

        <Label style={{ marginBottom: theme.spacing.xs }}>Daily Verse Source</Label>
        <PressableScale onPress={() => selectAsVerseSource(null)} scaleTo={0.99}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: activeId === null ? theme.colors.primary : theme.colors.border,
              padding: theme.spacing.md,
              marginBottom: theme.spacing.md,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: theme.radius.sm,
                backgroundColor: theme.colors.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={18} color={theme.colors.accent} strokeWidth={1.75} />
            </View>
            <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
              <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }}>Whole Bible</Body>
              <Label style={{ marginTop: 2 }}>Default — a verse from anywhere in Scripture</Label>
            </View>
            {renderRadio(activeId === null)}
          </View>
        </PressableScale>

        {customPlans.length > 0 && (
          <>
            <Label style={{ marginBottom: theme.spacing.sm }}>Your Plans</Label>
            {customPlans.map(renderPlan)}
          </>
        )}

        <Label style={{ marginBottom: theme.spacing.sm, marginTop: customPlans.length > 0 ? theme.spacing.sm : 0 }}>
          Suggested Plans
        </Label>
        {READING_PLANS.map(renderPlan)}
      </ScrollView>
    </SafeAreaView>
  );
}
