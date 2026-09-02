import React, { useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BookMarked, ChevronRight, Search } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { EGW_BOOK_LIST } from '@/database/egwBooks';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Label } from '@/components/ui/Typography';

export default function EgwBookListScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const books = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return EGW_BOOK_LIST;
    return EGW_BOOK_LIST.filter((b) => b.title.toLowerCase().includes(q));
  }, [query]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <FlatList
        data={books}
        keyExtractor={(item) => item.code}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        ListHeaderComponent={
          <>
            <Label style={{ marginBottom: theme.spacing.sm }}>
              Public-domain writings of Ellen G. White
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
                placeholder="Search books"
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
            No books match "{query}".
          </Body>
        }
        renderItem={({ item, index }) => (
          <PressableScale
            onPress={() => router.push({ pathname: '/more/egw/[code]', params: { code: item.code } })}
            scaleTo={0.99}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: theme.spacing.md,
                borderBottomWidth: index === books.length - 1 ? 0 : 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <BookMarked size={22} color={theme.colors.primary} strokeWidth={1.75} />
              <Body style={{ flex: 1, marginLeft: theme.spacing.sm }}>{item.title}</Body>
              <ChevronRight size={16} color={theme.colors.textFaint} />
            </View>
          </PressableScale>
        )}
      />
    </SafeAreaView>
  );
}
