import React, { useCallback, useLayoutEffect } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Pause, Play } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getHymn, HymnalLanguage } from '@/database/hymnal';
import { getHymnAudioModule, hasHymnAudio } from '@/database/hymnAudioAssets';
import { getHymnSheetMusicModules } from '@/database/hymnSheetMusicAssets';
import { resolveAssetUri } from '@/database/resolveAssetUri';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerProvider';
import { showAlert } from '@/components/ui/AppAlert';
import { PageLoader } from '@/components/ui/PageLoader';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body } from '@/components/ui/Typography';

export default function HymnSheetMusicScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { language, number } = useLocalSearchParams<{ language: HymnalLanguage; number: string }>();
  const lang = language ?? 'english';
  const num = Number(number);
  const hymn = getHymn(lang, num);
  const pages = getHymnSheetMusicModules(num);
  const { nowPlaying, playing, play, pause, resume } = useAudioPlayerContext();

  // Same tune is shared across every language (see database/hymnAudioAssets.ts), so identify
  // "is this hymn the one playing" by number rather than by the language-specific title.
  const isThisPlaying = !!nowPlaying && nowPlaying.title.startsWith(`${num}.`);

  const handlePlay = useCallback(async () => {
    if (!hasHymnAudio(num)) {
      showAlert('Audio not available', "This hymn doesn't have a tune recording yet.");
      return;
    }
    if (isThisPlaying) {
      if (playing) pause();
      else resume();
      return;
    }
    try {
      const uri = await resolveAssetUri(getHymnAudioModule(num)!);
      play(uri, `${num}. ${hymn?.title ?? ''}`, []);
    } catch {
      showAlert("Couldn't play", 'Something went wrong loading this hymn tune.');
    }
  }, [num, hymn, isThisPlaying, playing, play, pause, resume]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: hymn ? `${hymn.number}. ${hymn.title}` : 'Sheet Music',
      headerRight: () => (
        <PressableScale onPress={handlePlay} style={{ padding: theme.spacing.xs }}>
          {isThisPlaying && playing ? (
            <Pause size={20} color={theme.colors.primary} strokeWidth={1.75} />
          ) : (
            <Play size={20} color={isThisPlaying ? theme.colors.primary : theme.colors.text} strokeWidth={1.75} />
          )}
        </PressableScale>
      ),
    });
  }, [navigation, hymn, theme, handlePlay, isThisPlaying, playing]);

  if (!hymn) return <PageLoader />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <ScrollView
        maximumZoomScale={3}
        minimumZoomScale={1}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl, gap: theme.spacing.md }}
      >
        {!pages || pages.length === 0 ? (
          <Body style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing.xxl }}>
            No sheet music available for this hymn yet.
          </Body>
        ) : (
          pages.map((mod, i) => {
            const source = Image.resolveAssetSource(mod);
            const aspectRatio = source && source.height ? source.width / source.height : 0.77;
            return (
              <View
                key={i}
                style={{
                  width: '100%',
                  aspectRatio,
                  borderRadius: theme.radius.sm,
                  backgroundColor: '#ffffff',
                  overflow: 'hidden',
                }}
              >
                <Image source={mod} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
