import React, { useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronRight, Search } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getFundamentalBeliefs } from '@/database/fundamentalBeliefs';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Label } from '@/components/ui/Typography';

export default function BeliefsListScreen() {
  const theme = useTheme();
  const allBeliefs = getFundamentalBeliefs();
  const [query, setQuery] = useState('');

  const beliefs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allBeliefs;
    return allBeliefs.filter((b) => b.title.toLowerCase().includes(q) || b.content.toLowerCase().includes(q));
  }, [allBeliefs, query]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <FlatList
        data={beliefs}
        keyExtractor={(item) => String(item.number)}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        ListHeaderComponent={
          <>
            <Label style={{ marginBottom: theme.spacing.sm }}>
              The 28 Fundamental Beliefs of Seventh-day Adventists (2015 edition)
            </Label>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.lg,
                paddingHorizontal: theme.spacing.sm,
                marginBottom: theme.spacing.md,
                ...theme.shadow.subtle,
              }}
            >
              <Search size={16} color={theme.colors.textFaint} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search beliefs and their text"
                placeholderTextColor={theme.colors.textFaint}
                style={{
                  flex: 1,
                  padding: theme.spacing.sm,
                  color: theme.colors.text,
                  fontFamily: theme.fontFamily.sansRegular,
                  fontSize: theme.fontSize.base,
                }}
              />
            </View>
          </>
        }
        ListEmptyComponent={
          <Body style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing.lg }}>
            No beliefs match "{query}".
          </Body>
        }
        renderItem={({ item, index }) => (
          <PressableScale
            onPress={() => router.push({ pathname: '/more/beliefs/[number]', params: { number: String(item.number) } })}
            scaleTo={0.99}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: theme.spacing.sm + 2,
                borderBottomWidth: index === beliefs.length - 1 ? 0 : 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <Label style={{ width: 28 }}>{item.number}</Label>
              <Body style={{ flex: 1 }}>{item.title}</Body>
              <ChevronRight size={16} color={theme.colors.textFaint} />
            </View>
          </PressableScale>
        )}
      />
    </SafeAreaView>
  );
}
