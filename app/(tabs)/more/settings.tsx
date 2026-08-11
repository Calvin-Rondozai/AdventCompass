import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Bell, ChevronRight, HeartPulse, Moon, Monitor, Sun } from '@/components/ui/Icon';

import { useTheme, ThemePreference } from '@/theme/ThemeProvider';
import { PressableScale } from '@/components/ui/PressableScale';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { Body, Label } from '@/components/ui/Typography';

const THEME_OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

export default function SettingsScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: theme.spacing.xxl }}>
        <Label style={{ marginBottom: theme.spacing.xs }}>Appearance</Label>
        <AnimatedCard style={{ marginBottom: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {THEME_OPTIONS.map(({ value, label, Icon }) => {
              const selected = theme.preference === value;
              return (
                <PressableScale key={value} onPress={() => theme.setPreference(value)} scaleTo={0.96} style={{ flex: 1 }}>
                  <View
                    style={{
                      alignItems: 'center',
                      gap: 6,
                      paddingVertical: theme.spacing.sm + 2,
                      borderRadius: theme.radius.md,
                      backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceMuted,
                    }}
                  >
                    <Icon size={18} color={selected ? theme.colors.onPrimary : theme.colors.textMuted} strokeWidth={1.75} />
                    <Body
                      style={{
                        fontSize: theme.fontSize.xs,
                        color: selected ? theme.colors.onPrimary : theme.colors.textMuted,
                      }}
                    >
                      {label}
                    </Body>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        </AnimatedCard>

        <Label style={{ marginBottom: theme.spacing.xs }}>Notifications</Label>
        <PressableScale onPress={() => router.push('/more/notifications')} scaleTo={0.99}>
          <AnimatedCard style={{ flexDirection: 'row', alignItems: 'center' }}>
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
              <Bell size={18} color={theme.colors.primary} strokeWidth={1.75} />
            </View>
            <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
              <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }}>Reminders</Body>
              <Label style={{ marginTop: 2 }}>Water, prayer, Bible study, Sabbath & more</Label>
            </View>
            <ChevronRight size={18} color={theme.colors.textFaint} />
          </AnimatedCard>
        </PressableScale>

        <Label style={{ marginBottom: theme.spacing.xs, marginTop: theme.spacing.md }}>Health</Label>
        <PressableScale onPress={() => router.push('/more/health')} scaleTo={0.99}>
          <AnimatedCard style={{ flexDirection: 'row', alignItems: 'center' }}>
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
              <HeartPulse size={18} color={theme.colors.primary} strokeWidth={1.75} />
            </View>
            <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
              <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }}>Health & Wellness</Body>
              <Label style={{ marginTop: 2 }}>Exercise tracking</Label>
            </View>
            <ChevronRight size={18} color={theme.colors.textFaint} />
          </AnimatedCard>
        </PressableScale>
      </ScrollView>
    </SafeAreaView>
  );
}
