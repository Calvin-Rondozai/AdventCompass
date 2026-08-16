import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ArrowRight, Search as SearchIcon, BookOpen, ChevronRight } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { searchVerses, Verse } from '@/database/bible';
import { BIBLE_BOOKS, parseReference } from '@/database/bibleBooks';
import { getLocalizedBookName } from '@/database/bookNames';
import { useBibleTranslation } from '@/hooks/useBibleTranslation';
import { PressableScale } from '@/components/ui/PressableScale';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { Body, Label } from '@/components/ui/Typography';

function goToChapter(book: string, chapter: number, verse?: number | null) {
  router.push({
    pathname: '/bible/[book]/[chapter]',
    params: { book, chapter: String(chapter), ...(verse ? { verse: String(verse) } : {}) },
  });
}

function goToBook(book: string) {
  router.push({ pathname: '/bible/[book]', params: { book } });
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export default function BibleSearchScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { translation } = useBibleTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Verse[]>([]);
  const [searching, setSearching] = useState(false);

  const reference = useMemo(() => parseReference(query, translation), [query, translation]);

  const matchingBooks = useMemo(() => {
    const target = normalize(query);
    if (!target) return [];
    return BIBLE_BOOKS.filter((b) => {
      if (normalize(b.name).includes(target)) return true;
      return normalize(getLocalizedBookName(translation, b.name)).includes(target);
    }).slice(0, 8);
  }, [query, translation]);

  useEffect(() => {
    let cancelled = false;
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      searchVerses(db, translation, query).then((rows) => {
        if (!cancelled) {
          setResults(rows);
          setSearching(false);
        }
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [db, translation, query]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={[]}>
      <View style={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.lg,
            paddingHorizontal: theme.spacing.sm,
            ...theme.shadow.subtle,
          }}
        >
          <SearchIcon size={18} color={theme.colors.textFaint} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search a book, verse text, or 'John 3:16'"
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
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, paddingBottom: theme.spacing.xxl }}
        ListHeaderComponent={
          <>
            {reference && (
              <View style={{ marginBottom: theme.spacing.sm }}>
                <PressableScale
                  onPress={() => goToChapter(reference.book, reference.chapter, reference.verse)}
                  scaleTo={0.98}
                >
                  <AnimatedCard style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Label>Jump to</Label>
                      <Body style={{ fontFamily: theme.fontFamily.sansSemiBold, marginTop: 2 }}>
                        {getLocalizedBookName(translation, reference.book)} {reference.chapter}
                        {reference.verse ? `:${reference.verse}` : ''}
                      </Body>
                    </View>
                    <ArrowRight size={18} color={theme.colors.primary} />
                  </AnimatedCard>
                </PressableScale>
              </View>
            )}

            {matchingBooks.length > 0 && (
              <View style={{ marginBottom: theme.spacing.md }}>
                <Label style={{ marginBottom: theme.spacing.sm }}>Books</Label>
                {matchingBooks.map((b) => (
                  <PressableScale key={b.name} onPress={() => goToBook(b.name)} scaleTo={0.99}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: theme.colors.surface,
                        borderRadius: theme.radius.lg,
                        padding: theme.spacing.sm + 2,
                        marginBottom: theme.spacing.xs + 2,
                        ...theme.shadow.subtle,
                      }}
                    >
                      <BookOpen size={16} color={theme.colors.primary} strokeWidth={1.75} />
                      <Body style={{ flex: 1, marginLeft: theme.spacing.sm }}>
                        {getLocalizedBookName(translation, b.name)}
                      </Body>
                      <ChevronRight size={16} color={theme.colors.textFaint} />
                    </View>
                  </PressableScale>
                ))}
              </View>
            )}

            {query.trim().length >= 3 && <Label style={{ marginBottom: theme.spacing.sm }}>Verses</Label>}
          </>
        }
        ListEmptyComponent={
          query.trim().length >= 3 && !searching ? (
            <Body style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing.sm }}>
              No verses found.
            </Body>
          ) : null
        }
        renderItem={({ item }) => (
          <PressableScale onPress={() => goToChapter(item.book, item.chapter, item.verse)} scaleTo={0.99}>
            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.lg,
                padding: theme.spacing.md,
                marginBottom: theme.spacing.sm,
                ...theme.shadow.subtle,
              }}
            >
              <Label style={{ marginBottom: 4 }}>
                {getLocalizedBookName(translation, item.book)} {item.chapter}:{item.verse}
              </Label>
              <Body numberOfLines={3}>{item.text}</Body>
            </View>
          </PressableScale>
        )}
      />
    </SafeAreaView>
  );
}
