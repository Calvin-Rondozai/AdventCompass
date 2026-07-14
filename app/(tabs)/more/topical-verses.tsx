import React from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronRight, Heart } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { TOPICS } from '@/database/topicalVerses';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Label } from '@/components/ui/Typography';

export default function TopicalVersesScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <FlatList
        data={TOPICS}
        keyExtractor={(item) => item.key}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        ListHeaderComponent={
          <Body style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.md, fontSize: theme.fontSize.sm }}>
            Pick how you're feeling or what you're facing — find Scripture that speaks to it.
          </Body>
        }
        renderItem={({ item }) => (
          <PressableScale onPress={() => router.push({ pathname: '/more/topical-verses/[topic]', params: { topic: item.key } })} scaleTo={0.99}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.border,
                padding: theme.spacing.md,
                marginBottom: theme.spacing.sm,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: theme.radius.sm,
                  backgroundColor: theme.colors.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Heart size={16} color={theme.colors.accent} strokeWidth={1.75} />
              </View>
              <Body style={{ flex: 1, marginLeft: theme.spacing.sm, fontFamily: theme.fontFamily.sansSemiBold }}>
                {item.label}
              </Body>
              <Label style={{ marginRight: theme.spacing.xs }}>{item.verses.length}</Label>
              <ChevronRight size={16} color={theme.colors.textFaint} />
            </View>
          </PressableScale>
        )}
      />
    </SafeAreaView>
  );
}
