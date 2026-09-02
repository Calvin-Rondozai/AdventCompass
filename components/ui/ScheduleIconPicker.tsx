import React from 'react';
import { View } from 'react-native';

import {
  BookHeart,
  BookOpen,
  CalendarDays,
  Droplets,
  Dumbbell,
  Flame,
  Gift,
  Heart,
  HeartHandshake,
  HeartPulse,
  ListChecks,
  Mail,
  Moon,
  Music,
  Palette,
  Pencil,
  Sparkles,
  Sun,
} from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { PressableScale } from '@/components/ui/PressableScale';

// The fixed set of icons a user can attach to a custom "Today's Schedule" item — stored
// as this name string in custom_habits.icon, resolved back to a component via ICON_MAP.
export const SCHEDULE_ICON_CHOICES = [
  'BookOpen',
  'HeartHandshake',
  'Dumbbell',
  'Droplets',
  'BookHeart',
  'Heart',
  'HeartPulse',
  'Sun',
  'Moon',
  'Music',
  'Mail',
  'Pencil',
  'Palette',
  'ListChecks',
  'Gift',
  'Sparkles',
  'CalendarDays',
  'Flame',
] as const;

export type ScheduleIconName = (typeof SCHEDULE_ICON_CHOICES)[number];

const ICON_MAP: Record<ScheduleIconName, typeof BookOpen> = {
  BookOpen,
  HeartHandshake,
  Dumbbell,
  Droplets,
  BookHeart,
  Heart,
  HeartPulse,
  Sun,
  Moon,
  Music,
  Mail,
  Pencil,
  Palette,
  ListChecks,
  Gift,
  Sparkles,
  CalendarDays,
  Flame,
};

export function getScheduleIcon(name: string): typeof BookOpen {
  return ICON_MAP[name as ScheduleIconName] ?? ListChecks;
}

type Props = { value: string; onChange: (name: ScheduleIconName) => void };

export function ScheduleIconPicker({ value, onChange }: Props) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
      {SCHEDULE_ICON_CHOICES.map((name) => {
        const Icon = ICON_MAP[name];
        const selected = value === name;
        return (
          <PressableScale key={name} onPress={() => onChange(name)} scaleTo={0.9}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: theme.radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? theme.colors.accent : theme.colors.border,
              }}
            >
              <Icon size={20} color={selected ? theme.colors.accent : theme.colors.textMuted} strokeWidth={1.75} />
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
