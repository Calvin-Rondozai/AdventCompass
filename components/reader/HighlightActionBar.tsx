import React from 'react';
import { View } from 'react-native';
import { Trash2, X } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { HIGHLIGHT_COLORS, HIGHLIGHT_HEX, HighlightColor } from '@/database/highlights';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body } from '@/components/ui/Typography';

type Props = {
  wordCount: number;
  hasExistingHighlight: boolean;
  onPickColor: (color: HighlightColor) => void;
  onRemove: () => void;
  onCancel: () => void;
};

// Shared bottom bar shown once a HighlightableText drag-selection finishes — lets the
// user pick a color to add, or remove whatever highlight(s) already overlap the range.
export function HighlightActionBar({ wordCount, hasExistingHighlight, onPickColor, onRemove, onCancel }: Props) {
  const theme = useTheme();
  const swatchHex = HIGHLIGHT_HEX[theme.scheme];

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
        {HIGHLIGHT_COLORS.map((c) => (
          <PressableScale key={c} onPress={() => onPickColor(c)} scaleTo={0.85}>
            <View style={{ width: 32, height: 32, borderRadius: theme.radius.pill, backgroundColor: swatchHex[c] }} />
          </PressableScale>
        ))}
        {hasExistingHighlight && (
          <PressableScale onPress={onRemove} scaleTo={0.85} style={{ marginLeft: theme.spacing.xs }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.surfaceMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Trash2 size={16} color={theme.colors.danger} />
            </View>
          </PressableScale>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Body style={{ flex: 1, color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
          {wordCount} word{wordCount === 1 ? '' : 's'} selected — pick a color
        </Body>
        <PressableScale onPress={onCancel} style={{ padding: theme.spacing.xs }}>
          <X size={20} color={theme.colors.textMuted} strokeWidth={1.75} />
        </PressableScale>
      </View>
    </View>
  );
}
