import React from 'react';
import { Image, Linking, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { ChevronRight, Mail, User } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { PressableScale } from '@/components/ui/PressableScale';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { Body, Heading, Label } from '@/components/ui/Typography';

const CONTACT_EMAIL = 'rondozaicalvin@gmail.com';
const DEVELOPER = 'Calvin Rondozai';

export default function AboutScreen() {
  const theme = useTheme();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const rows = [
    { icon: User, label: 'Developer', value: DEVELOPER },
    { icon: Mail, label: 'Contact', value: CONTACT_EMAIL, onPress: () => Linking.openURL(`mailto:${CONTACT_EMAIL}`) },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <View style={{ flex: 1, padding: theme.spacing.lg, justifyContent: 'space-between' }}>
        <View style={{ gap: theme.spacing.lg }}>
          <View style={{ alignItems: 'center', marginTop: theme.spacing.xl }}>
            <Image
              source={require('@/assets/ico.png')}
              resizeMode="contain"
              style={{ width: 100, height: 100, marginBottom: theme.spacing.md }}
            />
            <Heading style={{ fontSize: theme.fontSize.xl }}>AdventCompass</Heading>
            <Label style={{ marginTop: 4 }}>Version {version}</Label>
          </View>

          <AnimatedCard style={{ padding: 0, overflow: 'hidden' }}>
            {rows.map((row, i) => (
              <PressableScale key={row.label} onPress={row.onPress} disabled={!row.onPress} scaleTo={0.99}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: theme.spacing.sm + 4,
                    paddingHorizontal: theme.spacing.md,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: theme.colors.border,
                  }}
                >
                  <row.icon size={18} color={theme.colors.primary} strokeWidth={1.75} />
                  <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
                    <Label>{row.label}</Label>
                    <Body style={{ marginTop: 1, color: row.onPress ? theme.colors.primary : theme.colors.text }}>
                      {row.value}
                    </Body>
                  </View>
                  {row.onPress && <ChevronRight size={16} color={theme.colors.textFaint} />}
                </View>
              </PressableScale>
            ))}
          </AnimatedCard>
        </View>

        <Label style={{ textAlign: 'center', marginBottom: theme.spacing.md }}>
          Powered by Hello C.
        </Label>
      </View>
    </SafeAreaView>
  );
}
