import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronRight, Heart, Music } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { HYMNALS } from '@/database/hymnal';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Label } from '@/components/ui/Typography';

export default function HymnalLanguagesScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: theme.spacing.xxl }}>
        <PressableScale onPress={() => router.push('/hymnal/favorites')} scaleTo={0.99}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: theme.spacing.md,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: theme.radius.sm,
                backgroundColor: theme.colors.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Heart size={18} color={theme.colors.accent} strokeWidth={1.75} fill={theme.colors.accent} />
            </View>
            <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
              <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }}>Favorites</Body>
              <Label style={{ marginTop: 2 }}>Hymns you've marked, across every language</Label>
            </View>
            <ChevronRight size={18} color={theme.colors.textFaint} />
          </View>
        </PressableScale>

        {HYMNALS.map((hymnal) => (
          <PressableScale
            key={hymnal.code}
            onPress={() => router.push({ pathname: '/hymnal/[language]', params: { language: hymnal.code } })}
            scaleTo={0.99}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.border,
                padding: theme.spacing.md,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: theme.radius.sm,
                  backgroundColor: theme.colors.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Music size={18} color={theme.colors.primary} strokeWidth={1.75} />
              </View>
              <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }}>{hymnal.label}</Body>
                <Label style={{ marginTop: 2 }}>{hymnal.source}</Label>
              </View>
              <ChevronRight size={18} color={theme.colors.textFaint} />
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
