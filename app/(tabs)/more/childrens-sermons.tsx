import React, { useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronRight, Search } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getChildrensSermons } from '@/database/childrensSermons';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Label } from '@/components/ui/Typography';

export default function ChildrensSermonsListScreen() {
  const theme = useTheme();
  const allSermons = getChildrensSermons();
  const [query, setQuery] = useState('');

  const sermons = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allSermons;
    return allSermons.filter(
      (s) => s.title.toLowerCase().includes(q) || s.theme.toLowerCase().includes(q) || s.scriptureRef.toLowerCase().includes(q)
    );
  }, [allSermons, query]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <FlatList
        data={sermons}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        ListHeaderComponent={
          <>
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
                placeholder="Search sermons, themes, or scripture"
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
            No sermons match "{query}".
          </Body>
        }
        renderItem={({ item }) => (
          <PressableScale onPress={() => router.push({ pathname: '/more/childrens-sermons/[id]', params: { id: item.id } })} scaleTo={0.99}>
            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.lg,
                padding: theme.spacing.md,
                marginBottom: theme.spacing.xs + 2,
                ...theme.shadow.subtle,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Body style={{ flex: 1, fontFamily: theme.fontFamily.sansSemiBold }} numberOfLines={1}>
                  {item.title}
                </Body>
                <ChevronRight size={16} color={theme.colors.textFaint} />
              </View>
              {!!item.theme && (
                <Body style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm, marginTop: 4 }} numberOfLines={2}>
                  {item.theme}
                </Body>
              )}
              <Label style={{ marginTop: theme.spacing.xs, color: theme.colors.primary }}>{item.scriptureRef}</Label>
            </View>
          </PressableScale>
        )}
      />
    </SafeAreaView>
  );
}
