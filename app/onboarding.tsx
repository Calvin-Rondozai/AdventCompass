import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Bell,
  BookHeart,
  BookOpen,
  BookMarked,
  CalendarClock,
  CalendarDays,
  Copy,
  Download,
  Gift,
  HandCoins,
  HeartHandshake,
  HeartPulse,
  Library,
  Link2,
  ListChecks,
  Music,
  NotebookPen,
  Sparkles,
  Sun,
  Volume2,
  Wifi,
} from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { setKv } from '@/database/kv';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Heading } from '@/components/ui/Typography';

const STUDY_FEATURES = [
  { Icon: BookOpen, label: 'Bible in 5 translations, with search & bookmarks' },
  { Icon: BookMarked, label: "Ellen G. White's writings — all 49 books" },
  { Icon: Library, label: 'Bible Commentary for deeper study' },
  { Icon: CalendarDays, label: 'Sabbath School lessons, auto-updated' },
  { Icon: BookHeart, label: 'Daily devotions & Bible reading plans' },
  { Icon: ListChecks, label: 'Fundamental Beliefs & topical verses' },
  { Icon: Volume2, label: 'Read Aloud narration for the Bible, EGW books & devotions' },
  { Icon: Copy, label: 'Copy & share verses instantly' },
];

const TOOLS_FEATURES = [
  { Icon: Music, label: 'Hymnal in English, chiShona & isiNdebele, with audio & sheet music' },
  { Icon: NotebookPen, label: 'Notes with categories, pinning & archive' },
  { Icon: HeartHandshake, label: 'Prayer journal' },
  { Icon: HeartPulse, label: 'Health & habit tracking, with home screen widgets' },
  { Icon: Gift, label: "Children's sermons" },
  { Icon: HandCoins, label: 'Offertory readings' },
  { Icon: CalendarClock, label: 'Special days calendar' },
  { Icon: Bell, label: 'Smart reminders for prayer, water, Bible study & Sabbath' },
  { Icon: Sun, label: 'Sabbath greeting, timed to your local sunset' },
];

const AI_HIGHLIGHTS = [
  { Icon: Sparkles, label: "Ask Hello C anything. It answers from the Bible, all 49 EGW books, commentary, and hymns already in the app" },
  { Icon: Library, label: 'Tap any verse to open matching SDA Bible Commentary' },
  { Icon: Link2, label: 'Follow cross-references to every related verse instantly' },
  { Icon: Download, label: 'Offline mode: download the AI model once (~800MB) — after that it answers forever with no internet needed' },
  { Icon: Wifi, label: 'Online mode: skip the download and get answers instantly over your connection instead' },
];

export default function OnboardingScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const [page, setPage] = useState(0);

  const finish = async () => {
    await setKv(db, 'onboarding_complete', '1');
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ flex: 1, padding: theme.spacing.lg }}>
        {/* justifyContent: 'center' vertically centers each page as a block, with visible
            space above and below rather than content stretched edge-to-edge — page 1's list
            is bounded to a maxHeight (not flex: 1, which used to consume all available space
            and defeat the centering) so it still scrolls if it doesn't fit, but centers like
            the others when it does. */}
        <View style={{ flex: 1, justifyContent: 'center' }}>
        {page === 0 && (
          <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
            <Image source={require('@/assets/ico.png')} resizeMode="contain" style={{ width: 140, height: 140 }} />
            <Heading style={{ fontSize: theme.fontSize.xxl, textAlign: 'center' }}>Welcome to AdventCompass</Heading>
            <Body style={{ color: theme.colors.textMuted, textAlign: 'center', paddingHorizontal: theme.spacing.md }}>
              Your offline companion for Bible study, Adventist resources, and daily devotion, everywhere you go,
              no connection needed.
            </Body>
          </View>
        )}

        {page === 1 && (
          <View style={{ gap: theme.spacing.md }}>
            <Heading style={{ fontSize: theme.fontSize.xl, textAlign: 'center' }}>Study anywhere, anytime</Heading>
            {/* Smaller icons and tighter row gap than the welcome/AI pages specifically to
                make room for the full list without scrolling. */}
            <View style={{ gap: theme.spacing.xs + 4 }}>
              {STUDY_FEATURES.map(({ Icon, label }) => (
                <View key={label} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon size={20} color={theme.colors.primary} strokeWidth={1.75} />
                  <Body style={{ flex: 1, marginLeft: theme.spacing.sm, fontSize: theme.fontSize.sm }}>{label}</Body>
                </View>
              ))}
            </View>
          </View>
        )}

        {page === 2 && (
          <View style={{ gap: theme.spacing.md }}>
            <Heading style={{ fontSize: theme.fontSize.xl, textAlign: 'center' }}>Tools for daily life</Heading>
            <View style={{ gap: theme.spacing.xs + 4 }}>
              {TOOLS_FEATURES.map(({ Icon, label }) => (
                <View key={label} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon size={20} color={theme.colors.primary} strokeWidth={1.75} />
                  <Body style={{ flex: 1, marginLeft: theme.spacing.sm, fontSize: theme.fontSize.sm }}>{label}</Body>
                </View>
              ))}
            </View>
          </View>
        )}

        {page === 3 && (
          <View style={{ gap: theme.spacing.lg }}>
            <Heading style={{ fontSize: theme.fontSize.xl, textAlign: 'center' }}>Verses, connected</Heading>
            <Body style={{ color: theme.colors.textMuted, textAlign: 'center', paddingHorizontal: theme.spacing.md }}>
              Every verse links out to what explains it further.
            </Body>
            <View style={{ gap: theme.spacing.md }}>
              {AI_HIGHLIGHTS.map(({ Icon, label }) => (
                <View key={label} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon size={24} color={theme.colors.primary} strokeWidth={1.75} />
                  <Body style={{ flex: 1, marginLeft: theme.spacing.sm, fontSize: theme.fontSize.sm }}>{label}</Body>
                </View>
              ))}
            </View>
          </View>
        )}
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xs }}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={{
                  width: i === page ? 20 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i === page ? theme.colors.primary : theme.colors.surfaceMuted,
                }}
              />
            ))}
          </View>
          <PressableScale onPress={() => (page < 3 ? setPage(page + 1) : finish())} scaleTo={0.98}>
            <View
              style={{
                backgroundColor: theme.colors.primary,
                borderRadius: theme.radius.md,
                padding: theme.spacing.sm + 4,
                alignItems: 'center',
              }}
            >
              <Body style={{ color: theme.colors.onPrimary, fontFamily: theme.fontFamily.sansSemiBold }}>
                {page < 3 ? 'Next' : 'Get Started'}
              </Body>
            </View>
          </PressableScale>
        </View>
      </View>
    </SafeAreaView>
  );
}
