import React from 'react';
import { View } from 'react-native';
import { Pause, Play, Settings, SkipBack, SkipForward, X } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import type { ReadAloudState } from '@/hooks/useReadAloud';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body } from '@/components/ui/Typography';

type Props = {
  state: ReadAloudState;
  label: string;
  onPlayPause: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
};

export function ReadAloudBar({ state, label, onPlayPause, onSkipBack, onSkipForward, onOpenSettings, onClose }: Props) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        gap: theme.spacing.xs,
      }}
    >
      <PressableScale onPress={onSkipBack} style={{ padding: theme.spacing.xs }}>
        <SkipBack size={18} color={theme.colors.text} />
      </PressableScale>
      <PressableScale onPress={onPlayPause} style={{ padding: theme.spacing.xs }}>
        {state === 'speaking' ? (
          <Pause size={30} color={theme.colors.primary} />
        ) : (
          <Play size={30} color={theme.colors.primary} />
        )}
      </PressableScale>
      <PressableScale onPress={onSkipForward} style={{ padding: theme.spacing.xs }}>
        <SkipForward size={18} color={theme.colors.text} />
      </PressableScale>
      <Body style={{ flex: 1, color: theme.colors.textMuted, fontSize: theme.fontSize.sm }} numberOfLines={1}>
        {label}
      </Body>
      <PressableScale onPress={onOpenSettings} style={{ padding: theme.spacing.xs }}>
        <Settings size={20} color={theme.colors.text} strokeWidth={1.75} />
      </PressableScale>
      <PressableScale onPress={onClose} style={{ padding: theme.spacing.xs }}>
        <X size={20} color={theme.colors.textMuted} strokeWidth={1.75} />
      </PressableScale>
    </View>
  );
}
