import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ChevronRight, Search } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { EgwBook, getEgwBook } from '@/database/egwBooks';
import { PageLoader } from '@/components/ui/PageLoader';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Label } from '@/components/ui/Typography';

export default function EgwChapterListScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const db = useSQLiteContext();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [book, setBook] = useState<EgwBook | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setBook(undefined);
    setFailed(false);
    getEgwBook(db, code ?? '')
      .then((b) => {
        if (!cancelled) setBook(b);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [db, code, retryToken]);

  const chapters = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !book) return book?.chapters ?? [];
    return book.chapters.filter((c) => c.title.toLowerCase().includes(q));
  }, [book, query]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: book?.title ?? '' });
  }, [navigation, book]);

  if (failed) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg }}>
        <Body style={{ color: theme.colors.textMuted, textAlign: 'center', marginBottom: theme.spacing.md }}>
          This book couldn't be loaded.
        </Body>
        <PressableScale onPress={() => setRetryToken((n) => n + 1)}>
          <Body style={{ color: theme.colors.primary, fontFamily: theme.fontFamily.sansSemiBold }}>Try again</Body>
        </PressableScale>
      </SafeAreaView>
    );
  }

  if (!book) return <PageLoader />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <FlatList
        data={chapters}
        keyExtractor={(item) => String(item.number)}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        ListHeaderComponent={
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
              placeholder="Search chapters"
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
        }
        ListEmptyComponent={
          <Body style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing.lg }}>
            No chapters match "{query}".
          </Body>
        }
        renderItem={({ item, index }) => (
          <PressableScale
            onPress={() =>
              router.push({ pathname: '/more/egw/[code]/[number]', params: { code: code ?? '', number: String(item.number) } })
            }
            scaleTo={0.99}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: theme.spacing.sm + 2,
                borderBottomWidth: index === chapters.length - 1 ? 0 : 1,
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
