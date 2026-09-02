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
            Pick how you're feeling or what you're facing to find Scripture that speaks to it.
          </Body>
        }
        renderItem={({ item, index }) => (
          <PressableScale onPress={() => router.push({ pathname: '/more/topical-verses/[topic]', params: { topic: item.key } })} scaleTo={0.99}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: theme.spacing.md,
                borderBottomWidth: index === TOPICS.length - 1 ? 0 : 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <Heart size={22} color={theme.colors.accent} strokeWidth={1.75} />
              <Body style={{ flex: 1, marginLeft: theme.spacing.md, fontFamily: theme.fontFamily.sansSemiBold }}>
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
