import React from 'react';
import { Modal, Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Heading, Label } from '@/components/ui/Typography';
import { getScheduleIcon } from '@/components/ui/ScheduleIconPicker';
import type { WeeklySummaryStat } from '@/database/habits';

type Props = { stats: WeeklySummaryStat[] | null; onClose: () => void };

function performanceLine(avgPercent: number): string {
  if (avgPercent >= 85) return "Outstanding week — you're building real consistency.";
  if (avgPercent >= 60) return 'Solid week overall — keep the momentum going.';
  if (avgPercent >= 30) return 'A start! A little more consistency next week will go a long way.';
  return 'A quiet week — next week is a fresh chance to build the habit back up.';
}

export function WeeklySummaryModal({ stats, onClose }: Props) {
  const theme = useTheme();
  const visible = !!stats && stats.length > 0;
  const avgPercent = visible ? Math.round((stats!.reduce((sum, s) => sum + s.completedDays, 0) / (stats!.length * 7)) * 100) : 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg }}
        onPress={onClose}
      >
        <Pressable
          style={{
            width: '100%',
            maxWidth: 380,
            backgroundColor: theme.colors.background,
            borderRadius: theme.radius.xl,
            padding: theme.spacing.lg,
            gap: theme.spacing.md,
            ...theme.shadow.floating,
          }}
        >
          <View>
            <Label style={{ color: theme.colors.accent }}>Your Weekly Summary</Label>
            <Heading style={{ fontSize: theme.fontSize.lg, marginTop: 4 }}>{avgPercent}% average completion</Heading>
            <Body style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm, marginTop: 2 }}>
              {performanceLine(avgPercent)}
            </Body>
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            {stats?.map((stat) => {
              const Icon = getScheduleIcon(stat.icon);
              const pct = stat.completedDays / 7;
              return (
                <View key={stat.type} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <Icon size={18} color={theme.colors.primary} strokeWidth={1.75} />
                  <Body style={{ flex: 1, fontFamily: theme.fontFamily.sansMedium }} numberOfLines={1}>
                    {stat.label}
                  </Body>
                  <View style={{ width: 90, height: 6, borderRadius: 3, backgroundColor: theme.colors.surfaceMuted, overflow: 'hidden' }}>
                    <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: theme.colors.success }} />
                  </View>
                  <Body style={{ width: 32, textAlign: 'right', fontSize: theme.fontSize.sm, color: theme.colors.textMuted }}>
                    {stat.completedDays}/7
                  </Body>
                </View>
              );
            })}
          </View>

          <PressableScale onPress={onClose} scaleTo={0.98}>
            <View
              style={{
                padding: theme.spacing.sm + 2,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                marginTop: theme.spacing.xs,
              }}
            >
              <Body style={{ color: theme.colors.onPrimary, fontFamily: theme.fontFamily.sansSemiBold }}>Keep Going</Body>
            </View>
          </PressableScale>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
