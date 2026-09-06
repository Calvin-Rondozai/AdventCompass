import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { runOnJS } from 'react-native-reanimated';
import { Heart, Library, Play } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getHymn, HymnalLanguage } from '@/database/hymnal';
import { toggleHymnFavorite, getFavoriteHymnNumbers } from '@/database/hymnFavorites';
import { getHymnNote } from '@/database/hymnNotes';
import { HymnNumberJump } from '@/components/bible/HymnNumberJump';
import { HymnalLanguageSheet, HymnalLanguageSheetHandle } from '@/components/hymnal/HymnalLanguageSheet';
import { showAlert } from '@/components/ui/AppAlert';
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
  const languageSheetRef = useRef<HymnalLanguageSheetHandle>(null);

  useEffect(() => {
    getFavoriteHymnNumbers(db).then((favorites) => setIsFavorite(favorites.has(num)));
  }, [db, num]);

  const handleToggleFavorite = useCallback(() => {
    toggleHymnFavorite(db, lang, num).then(setIsFavorite);
  }, [db, lang, num]);

  // No sheet-music/audio is attached to any hymn — a prior attempt at importing them
  // from a numbered-only source (no titles to verify against) turned out mismatched and
  // was removed. This is a placeholder until a source that can be verified is found.
  const handlePlay = useCallback(() => {
    showAlert('Audio not available', "Sheet music and MIDI playback for this hymn haven't been added yet.");
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: hymn ? `${hymn.number}. ${hymn.title}` : '',
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <PressableScale onPress={handlePlay} style={{ padding: theme.spacing.xs }}>
            <Play size={20} color={theme.colors.text} strokeWidth={1.75} />
          </PressableScale>
          <PressableScale onPress={handleToggleFavorite} style={{ padding: theme.spacing.xs }}>
            <Heart
              size={20}
              color={isFavorite ? theme.colors.danger : theme.colors.text}
              fill={isFavorite ? theme.colors.danger : undefined}
              strokeWidth={1.75}
            />
          </PressableScale>
          <PressableScale onPress={() => languageSheetRef.current?.open()} style={{ padding: theme.spacing.xs }}>
            <Library size={20} color={theme.colors.text} strokeWidth={1.75} />
          </PressableScale>
        </View>
      ),
    });
  }, [navigation, hymn, theme, isFavorite, handleToggleFavorite, handlePlay]);

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

  const note = getHymnNote(num);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <GestureDetector gesture={swipeGesture}>
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
          <Heading style={{ marginBottom: theme.spacing.md }}>{hymn.title}</Heading>

          {note && (
            <View
              style={{
                marginBottom: theme.spacing.lg,
                paddingBottom: theme.spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              {(note.author || note.composer) && (
                <Body style={{ fontSize: theme.fontSize.sm, color: theme.colors.textMuted }}>
                  {[note.author && `Words: ${note.author}`, note.composer && `Music: ${note.composer}`]
                    .filter(Boolean)
                    .join('   ·   ')}
                </Body>
              )}
              {note.verseText && (
                <Body
                  style={{
                    fontFamily: theme.fontFamily.serifItalic,
                    fontSize: theme.fontSize.sm,
                    color: theme.colors.textMuted,
                    marginTop: theme.spacing.xs,
                  }}
                >
                  “{note.verseText}”{note.verseRef ? ` — ${note.verseRef}` : ''}
                </Body>
              )}
              {note.copyright && (
                <Body style={{ fontSize: theme.fontSize.xs, color: theme.colors.textFaint, marginTop: theme.spacing.xs }}>
                  {note.copyright}
                </Body>
              )}
            </View>
          )}

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
      <HymnalLanguageSheet ref={languageSheetRef} currentLanguage={lang} hymnNumber={num} />
    </SafeAreaView>
  );
}
