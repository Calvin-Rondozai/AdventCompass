import React, { useState } from 'react';
import { View } from 'react-native';
import { ChevronDown, ChevronRight } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body } from '@/components/ui/Typography';

// Matches the collapsed-by-default "Additional Reading" / "Further Study" card style
// used by the official Sabbath School app — tap the header to expand.
export function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View
      style={{
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: theme.radius.md,
        marginBottom: theme.spacing.md,
        overflow: 'hidden',
      }}
    >
      <PressableScale onPress={() => setOpen((v) => !v)} scaleTo={0.99}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: theme.spacing.sm + 2 }}>
          <Body style={{ flex: 1, fontFamily: theme.fontFamily.sansSemiBold, fontSize: theme.fontSize.sm }}>{title}</Body>
          {open ? (
            <ChevronDown size={16} color={theme.colors.textMuted} />
          ) : (
            <ChevronRight size={16} color={theme.colors.textMuted} />
          )}
        </View>
      </PressableScale>
      {open && <View style={{ padding: theme.spacing.sm + 2, paddingTop: 0 }}>{children}</View>}
    </View>
  );
}
