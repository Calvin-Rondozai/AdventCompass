import React, { useMemo } from 'react';
import { SectionList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getUpcomingSpecialDays, UpcomingSpecialDay } from '@/database/specialDays';
import { Body, Heading, Label } from '@/components/ui/Typography';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatRange(day: UpcomingSpecialDay): string {
  const startLabel = `${MONTH_NAMES[day.startMonth - 1]} ${day.startDay}`;
  if (day.endMonth == null || (day.endMonth === day.startMonth && day.endDay === day.startDay)) return startLabel;
  const endLabel =
    day.endMonth === day.startMonth ? `${day.endDay}` : `${MONTH_NAMES[day.endMonth - 1]} ${day.endDay}`;
  return `${startLabel}–${endLabel}`;
}

function daysUntil(date: Date): number {
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((date.getTime() - todayMidnight.getTime()) / 86_400_000);
}

export default function SpecialDaysScreen() {
  const theme = useTheme();
  const upcoming = useMemo(() => getUpcomingSpecialDays(), []);

  // Grouped by the month the NEXT occurrence actually falls in (which may already be
  // next year for something earlier in the calendar than today), not by startMonth
  // alone — that's what keeps the list in true chronological order.
  const sections = useMemo(() => {
    const map = new Map<string, UpcomingSpecialDay[]>();
    for (const day of upcoming) {
      const key = `${MONTH_NAMES[day.date.getMonth()]} ${day.date.getFullYear()}`;
      const list = map.get(key) ?? [];
      list.push(day);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [upcoming]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Label style={{ marginTop: theme.spacing.md, marginBottom: theme.spacing.xs }}>{section.title}</Label>
        )}
        renderItem={({ item }) => {
          const daysAway = daysUntil(item.date);
          const isSoon = daysAway <= 7;
          return (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: isSoon ? theme.colors.primary : theme.colors.border,
                padding: theme.spacing.md,
                marginBottom: theme.spacing.sm,
              }}
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
                <CalendarDays size={18} color={theme.colors.primary} strokeWidth={1.75} />
              </View>
              <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }}>{item.title}</Body>
                <Label style={{ marginTop: 2 }}>
                  {formatRange(item)}
                  {daysAway === 0 ? ' · Today' : daysAway === 1 ? ' · Tomorrow' : isSoon ? ` · In ${daysAway} days` : ''}
                </Label>
              </View>
            </View>
          );
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.sm }}>
            <Heading style={{ fontSize: theme.fontSize.lg, marginBottom: 4 }}>Special Days</Heading>
            <Body style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
              The General Conference's calendar of special days, events, and offerings. You'll get a
              notification on the morning of each one.
            </Body>
          </View>
        }
      />
    </SafeAreaView>
  );
}
