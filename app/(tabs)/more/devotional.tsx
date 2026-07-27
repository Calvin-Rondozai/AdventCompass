import React, { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { BackHandler, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useNavigation } from 'expo-router';
import { ArrowLeft, Sunrise, Moon, ChevronRight, HeartHandshake } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getDevotionalOfDay, getPromptOfDay, MORNING_PROMPTS, EVENING_PROMPTS } from '@/database/devotionals';
import { parseReference } from '@/database/bibleBooks';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Heading, Label, ScriptureQuote } from '@/components/ui/Typography';

export default function DevotionsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const devotional = getDevotionalOfDay();
  const morningPrompt = getPromptOfDay(MORNING_PROMPTS);
  const eveningPrompt = getPromptOfDay(EVENING_PROMPTS);
  const parsedRef = useMemo(() => parseReference(devotional.reference), [devotional.reference]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/more');
  }, []);

  // Reached both from the More menu (which has this screen underneath in its own
  // stack) and directly from the Home tab's teaser card (a cross-tab push, which
  // lands here with no screen beneath it in the More stack) — the default back
  // button only covers the first case, so provide one explicitly for both. The
  // hardware back button is wired to the same goBack() so it always matches the arrow.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [goBack]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <PressableScale onPress={goBack} style={{ padding: theme.spacing.xs }}>
          <ArrowLeft size={22} color={theme.colors.text} strokeWidth={2} />
        </PressableScale>
      ),
    });
  }, [navigation, theme, goBack]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl }}>
        <AnimatedCard>
          <Label style={{ color: theme.colors.accent, marginBottom: theme.spacing.sm }}>Today's Devotional</Label>
          <Heading style={{ marginBottom: 4 }}>{devotional.title}</Heading>
          <PressableScale
            disabled={!parsedRef}
            onPress={() =>
              parsedRef &&
              router.push({
                pathname: '/bible/[book]/[chapter]',
                params: {
                  book: parsedRef.book,
                  chapter: String(parsedRef.chapter),
                  ...(parsedRef.verse ? { verse: String(parsedRef.verse) } : {}),
                },
              })
            }
            scaleTo={0.97}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: theme.spacing.sm }}>
              <Body style={{ color: theme.colors.primary, fontFamily: theme.fontFamily.sansSemiBold }}>
                {devotional.reference}
              </Body>
              {parsedRef && <ChevronRight size={14} color={theme.colors.primary} />}
            </View>
          </PressableScale>
          <Body style={{ marginBottom: theme.spacing.sm }}>{devotional.body}</Body>
          <View
            style={{
              borderLeftWidth: 3,
              borderLeftColor: theme.colors.accent,
              paddingLeft: theme.spacing.sm,
            }}
          >
            <ScriptureQuote style={{ fontSize: theme.fontSize.base }}>{devotional.reflection}</ScriptureQuote>
          </View>
        </AnimatedCard>

        <AnimatedCard delay={60}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: theme.spacing.sm }}>
            <HeartHandshake size={16} color={theme.colors.primary} strokeWidth={1.75} />
            <Label>Prayer Points</Label>
          </View>
          {devotional.prayerPoints.map((point, i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: i < devotional.prayerPoints.length - 1 ? theme.spacing.xs : 0 }}>
              <Body style={{ color: theme.colors.primary, marginRight: theme.spacing.xs }}>•</Body>
              <Body style={{ flex: 1, color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>{point}</Body>
            </View>
          ))}
        </AnimatedCard>

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <AnimatedCard delay={120} style={{ flex: 1 }}>
            <Sunrise size={18} color={theme.colors.accent} strokeWidth={1.75} />
            <Label style={{ marginTop: theme.spacing.sm, marginBottom: 4 }}>Morning</Label>
            <Body style={{ fontSize: theme.fontSize.sm, color: theme.colors.textMuted }}>{morningPrompt}</Body>
          </AnimatedCard>
          <AnimatedCard delay={180} style={{ flex: 1 }}>
            <Moon size={18} color={theme.colors.primary} strokeWidth={1.75} />
            <Label style={{ marginTop: theme.spacing.sm, marginBottom: 4 }}>Evening</Label>
            <Body style={{ fontSize: theme.fontSize.sm, color: theme.colors.textMuted }}>{eveningPrompt}</Body>
          </AnimatedCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
