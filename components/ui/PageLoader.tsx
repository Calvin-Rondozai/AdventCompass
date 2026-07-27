import React from 'react';
import { View } from 'react-native';
import { MotiView } from 'moti';
import { useTheme } from '@/theme/ThemeProvider';
import { Sparkles } from '@/components/ui/Icon';

// Shared full-screen loading state for anywhere a screen would otherwise `return null`
// while its data loads (a blank flash, especially noticeable the first time a chapter or
// lesson opens) — a soft breathing pulse instead of a blank screen or a plain spinner.
export function PageLoader() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
      <MotiView
        from={{ opacity: 0.45, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1.08 }}
        transition={{ type: 'timing', duration: 750, loop: true }}
        style={{
          width: 64,
          height: 64,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Sparkles size={28} color={theme.colors.primary} strokeWidth={1.75} />
      </MotiView>
    </View>
  );
}
