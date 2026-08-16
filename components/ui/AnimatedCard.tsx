import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

export function AnimatedCard({ children, delay = 0, style }: Props) {
  const theme = useTheme();

  return (
    <MotiView
      from={{ opacity: 0, translateY: 18 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: theme.motion.base, delay }}
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.md,
          ...theme.shadow.subtle,
        },
        style,
      ]}
    >
      {children}
    </MotiView>
  );
}
