import React, { ComponentType } from 'react';
import { View } from 'react-native';
import { MotiView } from 'moti';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Body, Heading } from '@/components/ui/Typography';

type IconComponent = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export function ComingSoon({ Icon, title, description }: { Icon: IconComponent; title: string; description: string }) {
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl, gap: theme.spacing.md }}>
        <MotiView
          from={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: theme.motion.slow }}
        >
          <Icon size={64} color={theme.colors.primary} strokeWidth={1.5} />
        </MotiView>
        <Heading style={{ textAlign: 'center' }}>{title}</Heading>
        <Body style={{ textAlign: 'center', color: theme.colors.textMuted }}>{description}</Body>
      </View>
    </SafeAreaView>
  );
}
