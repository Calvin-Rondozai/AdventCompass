import React, { useCallback, useLayoutEffect } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { runOnJS } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { getHymn, HymnalLanguage } from '@/database/hymnal';
import { HymnNumberJump } from '@/components/bible/HymnNumberJump';
import { PageLoader } from '@/components/ui/PageLoader';
import { Body, Heading } from '@/components/ui/Typography';

export default function HymnDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { language, number } = useLocalSearchParams<{ language: HymnalLanguage; number: string }>();
  const lang = language ?? 'english';
  const num = Number(number);
  const hymn = getHymn(lang, num);
  const prevHymn = getHymn(lang, num - 1);
  const nextHymn = getHymn(lang, num + 1);

  useLayoutEffect(() => {
    navigation.setOptions({ title: hymn ? `${hymn.number}. ${hymn.title}` : '' });
  }, [navigation, hymn]);

  const goToHymn = useCallback(
    (target: number | undefined) => {
      if (!target) return;
      router.replace({ pathname: '/hymnal/[language]/[number]', params: { language: lang, number: String(target) } });
    },
    [lang]
  );

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      'worklet';
      if (e.translationX < -60 && e.velocityX < 0) {
        runOnJS(goToHymn)(nextHymn?.number);
      } else if (e.translationX > 60 && e.velocityX > 0) {
        runOnJS(goToHymn)(prevHymn?.number);
      }
    });

  if (!hymn) return <PageLoader />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <GestureDetector gesture={swipeGesture}>
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
          <Heading style={{ marginBottom: theme.spacing.md }}>{hymn.title}</Heading>
          {hymn.lyrics.split('\n').map((line, i) => {
            const isChorus = /^chorus[:.]?\s*$/i.test(line.trim());
            return (
              <Body
                key={i}
                style={{
                  fontFamily: isChorus ? theme.fontFamily.serifBold : theme.fontFamily.serifRegular,
                  fontSize: theme.fontSize.md,
                  lineHeight: theme.lineHeight.lg,
                }}
              >
                {line || ' '}
              </Body>
            );
          })}
        </ScrollView>
      </GestureDetector>

      <HymnNumberJump language={lang} replaceNavigation />
    </SafeAreaView>
  );
}
