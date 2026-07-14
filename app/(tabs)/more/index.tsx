import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  BookHeart,
  BookMarked,
  BookOpen,
  CalendarDays,
  HandCoins,
  Heart,
  HeartPulse,
  Info,
  Library,
  ListChecks,
  Music,
  Sparkles,
  Settings as SettingsIcon,
  ChevronRight,
} from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Label } from '@/components/ui/Typography';

const MENU = [
  { href: '/more/sabbath-school', Icon: CalendarDays, title: 'Sabbath School', subtitle: 'Adult Bible Study Guide, auto-updated' },
  { href: '/more/devotional', Icon: BookHeart, title: 'Devotions', subtitle: "Today's devotional & prayer prompts" },
  { href: '/more/reading-plans', Icon: BookOpen, title: 'Reading Plans', subtitle: 'John, Psalms, Proverbs, or your own' },
  { href: '/more/egw', Icon: BookMarked, title: 'Ellen G. White Books', subtitle: 'Steps to Christ, Desire of Ages & more' },
  { href: '/more/beliefs', Icon: ListChecks, title: 'Fundamental Beliefs', subtitle: '28 beliefs of Seventh-day Adventists' },
  { href: '/more/commentary', Icon: Library, title: 'Bible Commentary', subtitle: 'S.D.A. Bible Commentary, verse by verse' },
  { href: '/more/hymnal', Icon: Music, title: 'Hymnal', subtitle: 'English, chiShona & isiNdebele hymns' },
  { href: '/more/offertory', Icon: HandCoins, title: 'Offertory Reading', subtitle: 'Scripture readings for the offering' },
  { href: '/more/health', Icon: HeartPulse, title: 'Health & Wellness', subtitle: 'Exercise tracking' },
  { href: '/more/topical-verses', Icon: Heart, title: 'Topical Verses', subtitle: 'Anxiety, grief, joy & more — verses that help' },
  { href: '/more/ai-assistant', Icon: Sparkles, title: 'AI Bible Assistant', subtitle: 'Explain verses & topics' },
  { href: '/more/settings', Icon: SettingsIcon, title: 'Settings', subtitle: 'Reminders & preferences' },
  { href: '/more/about', Icon: Info, title: 'About', subtitle: 'Version, contact & credits' },
] as const;

export default function MoreMenuScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={[]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
        {MENU.map(({ href, Icon, title, subtitle }) => (
          <PressableScale key={href} onPress={() => router.push(href)} scaleTo={0.99}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.border,
                padding: theme.spacing.md,
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
                <Icon size={20} color={theme.colors.primary} strokeWidth={1.75} />
              </View>
              <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }}>{title}</Body>
                <Label style={{ marginTop: 2 }}>{subtitle}</Label>
              </View>
              <ChevronRight size={18} color={theme.colors.textFaint} />
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
