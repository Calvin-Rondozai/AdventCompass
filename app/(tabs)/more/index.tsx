import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  BookHeart,
  BookMarked,
  BookOpen,
  CalendarDays,
  CalendarClock,
  Gift,
  HandCoins,
  Heart,
  HeartHandshake,
  Info,
  Library,
  ListChecks,
  Sparkles,
  Settings as SettingsIcon,
  ChevronRight,
} from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body } from '@/components/ui/Typography';

// Grouped for visual breathing room only — routes, order, and item set are unchanged.
const SECTIONS = [
  {
    key: 'study',
    items: [
      { href: '/more/sabbath-school', Icon: CalendarDays, title: 'Sabbath School' },
      { href: '/more/devotional', Icon: BookHeart, title: 'Devotions' },
      { href: '/more/reading-plans', Icon: BookOpen, title: 'Reading Plans' },
      { href: '/more/egw', Icon: BookMarked, title: 'Ellen G. White Books' },
      { href: '/more/beliefs', Icon: ListChecks, title: 'Fundamental Beliefs' },
      { href: '/more/commentary', Icon: Library, title: 'Bible Commentary' },
    ],
  },
  {
    key: 'tools',
    items: [
      { href: '/more/prayer', Icon: HeartHandshake, title: 'Prayer Journal' },
      { href: '/more/offertory', Icon: HandCoins, title: 'Offertory Reading' },
      { href: '/more/topical-verses', Icon: Heart, title: 'Topical Verses' },
      { href: '/more/childrens-sermons', Icon: Gift, title: "Children's Sermons" },
      { href: '/more/special-days', Icon: CalendarClock, title: 'Special Days' },
      { href: '/more/ai-assistant', Icon: Sparkles, title: 'AI Bible Assistant' },
    ],
  },
  {
    key: 'app',
    items: [
      { href: '/more/settings', Icon: SettingsIcon, title: 'Settings' },
      { href: '/more/about', Icon: Info, title: 'About' },
    ],
  },
] as const;

export default function MoreMenuScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={[]}>
      <ScrollView contentContainerStyle={{ paddingVertical: theme.spacing.sm }}>
        {SECTIONS.map((section, sectionIndex) => (
          <View key={section.key} style={{ marginTop: sectionIndex === 0 ? 0 : theme.spacing.lg }}>
            {section.items.map(({ href, Icon, title }, itemIndex) => (
              <PressableScale key={href} onPress={() => router.push(href)} scaleTo={0.99}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: theme.spacing.md,
                    paddingHorizontal: theme.spacing.lg,
                    borderBottomWidth: itemIndex === section.items.length - 1 ? 0 : 1,
                    borderBottomColor: theme.colors.border,
                  }}
                >
                  <Icon size={24} color={theme.colors.primary} strokeWidth={1.75} />
                  <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                    <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }}>{title}</Body>
                  </View>
                  <ChevronRight size={16} color={theme.colors.textFaint} />
                </View>
              </PressableScale>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
