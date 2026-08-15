import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { runOnJS } from 'react-native-reanimated';
import { Heart } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getHymn, HymnalLanguage } from '@/database/hymnal';
import { toggleHymnFavorite, getFavoriteHymnNumbers } from '@/database/hymnFavorites';
import { HymnNumberJump } from '@/components/bible/HymnNumberJump';
import { PageLoader } from '@/components/ui/PageLoader';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Heading } from '@/components/ui/Typography';

export default function HymnDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const db = useSQLiteContext();
  const { language, number } = useLocalSearchParams<{ language: HymnalLanguage; number: string }>();
  const lang = language ?? 'english';
  const num = Number(number);
  const hymn = getHymn(lang, num);
  const prevHymn = getHymn(lang, num - 1);
  const nextHymn = getHymn(lang, num + 1);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    getFavoriteHymnNumbers(db).then((favorites) => setIsFavorite(favorites.has(num)));
  }, [db, num]);

  const handleToggleFavorite = useCallback(() => {
    toggleHymnFavorite(db, lang, num).then(setIsFavorite);
  }, [db, lang, num]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: hymn ? `${hymn.number}. ${hymn.title}` : '',
      headerRight: () => (
        <PressableScale onPress={handleToggleFavorite} style={{ padding: theme.spacing.xs }}>
          <Heart
            size={20}
            color={isFavorite ? theme.colors.danger : theme.colors.text}
            fill={isFavorite ? theme.colors.danger : undefined}
            strokeWidth={1.75}
          />
        </PressableScale>
      ),
    });
  }, [navigation, hymn, theme, isFavorite, handleToggleFavorite]);

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
