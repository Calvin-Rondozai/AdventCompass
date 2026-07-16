import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { BookHeart, BookOpen, BookMarked, CalendarDays, Gift, Library, Link2, Music, NotebookPen, Sparkles } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { setKv } from '@/database/kv';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Heading } from '@/components/ui/Typography';

const FEATURES = [
  { Icon: BookOpen, label: 'Bible in 5 translations' },
  { Icon: BookMarked, label: "Ellen White's writings & Commentary" },
  { Icon: CalendarDays, label: 'Sabbath School lessons, auto-updated' },
  { Icon: Music, label: 'Hymnal in English, chiShona & isiNdebele' },
  { Icon: BookHeart, label: 'Daily devotions' },
  { Icon: BookOpen, label: 'Bible reading plans' },
  { Icon: Gift, label: "Children's sermons" },
  { Icon: NotebookPen, label: 'Notes, prayer, and daily habits' },
  { Icon: Sparkles, label: 'Offline AI Bible Assistant' },
];

const AI_HIGHLIGHTS = [
  { Icon: Sparkles, label: "Ask Hello C anything. It answers from the Bible, EGW books, commentary, and hymns already in the app" },
  { Icon: Library, label: 'Tap any verse to open matching SDA Bible Commentary' },
  { Icon: Link2, label: 'Follow cross-references to every related verse instantly' },
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
            <Heading style={{ fontSize: theme.fontSize.xl, textAlign: 'center' }}>Everything in one place</Heading>
            {/* All 9 fit on one screen without scrolling — smaller icons and tighter row
                gap than the other pages specifically to make room for the full list. */}
            <View style={{ gap: theme.spacing.xs + 4 }}>
              {FEATURES.map(({ Icon, label }) => (
                <View key={label} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: theme.radius.sm,
                      backgroundColor: theme.colors.primarySoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={15} color={theme.colors.primary} strokeWidth={1.75} />
                  </View>
                  <Body style={{ flex: 1, marginLeft: theme.spacing.sm, fontSize: theme.fontSize.sm }}>{label}</Body>
                </View>
              ))}
            </View>
          </View>
        )}

        {page === 2 && (
          <View style={{ gap: theme.spacing.lg }}>
            <Heading style={{ fontSize: theme.fontSize.xl, textAlign: 'center' }}>Verses, connected</Heading>
            <Body style={{ color: theme.colors.textMuted, textAlign: 'center', paddingHorizontal: theme.spacing.md }}>
              Every verse links out to what explains it further.
            </Body>
            <View style={{ gap: theme.spacing.md }}>
              {AI_HIGHLIGHTS.map(({ Icon, label }) => (
                <View key={label} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: theme.radius.sm,
                      backgroundColor: theme.colors.primarySoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={17} color={theme.colors.primary} strokeWidth={1.75} />
                  </View>
                  <Body style={{ flex: 1, marginLeft: theme.spacing.sm, fontSize: theme.fontSize.sm }}>{label}</Body>
                </View>
              ))}
            </View>
          </View>
        )}
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xs }}>
            {[0, 1, 2].map((i) => (
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
          <PressableScale onPress={() => (page < 2 ? setPage(page + 1) : finish())} scaleTo={0.98}>
            <View
              style={{
                backgroundColor: theme.colors.primary,
                borderRadius: theme.radius.md,
                padding: theme.spacing.sm + 4,
                alignItems: 'center',
              }}
            >
              <Body style={{ color: theme.colors.onPrimary, fontFamily: theme.fontFamily.sansSemiBold }}>
                {page < 2 ? 'Next' : 'Get Started'}
              </Body>
            </View>
          </PressableScale>
        </View>
      </View>
    </SafeAreaView>
  );
}
