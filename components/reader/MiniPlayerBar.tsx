import React from 'react';
import { View } from 'react-native';
import { Pause, Play, X } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerProvider';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Label } from '@/components/ui/Typography';

// Global, persistent playback bar for a background-rendered reading (see
// services/ttsFileEngine.ts) — separate from ReadAloudBar, which only ever controls
// live, foreground-only speech for the reader screen it's mounted in.
export function MiniPlayerBar() {
  const theme = useTheme();
  const { nowPlaying, playing, positionMs, durationMs, pause, resume, stop } = useAudioPlayerContext();

  if (!nowPlaying) return null;

  const progress = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        ...theme.shadow.floating,
      }}
    >
      <View style={{ height: 2, backgroundColor: theme.colors.border }}>
        <View style={{ height: 2, width: `${progress * 100}%`, backgroundColor: theme.colors.primary }} />
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          gap: theme.spacing.sm,
        }}
      >
        <PressableScale onPress={() => (playing ? pause() : resume())} style={{ padding: 4 }}>
          {playing ? <Pause size={26} color={theme.colors.primary} /> : <Play size={26} color={theme.colors.primary} />}
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Body numberOfLines={1} style={{ fontFamily: theme.fontFamily.sansMedium }}>
            {nowPlaying.title}
          </Body>
          <Label>Playing in background</Label>
        </View>
        <PressableScale onPress={stop} style={{ padding: 4 }}>
          <X size={20} color={theme.colors.textMuted} strokeWidth={1.75} />
        </PressableScale>
      </View>
    </View>
  );
}
