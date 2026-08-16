import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Bookmark as BookmarkIcon } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getAllBookmarks } from '@/database/bookmarks';
import { getAllHighlights, HighlightColor } from '@/database/highlights';
import { getLocalizedBookName } from '@/database/bookNames';
import { useBibleTranslation } from '@/hooks/useBibleTranslation';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Heading } from '@/components/ui/Typography';

const HIGHLIGHT_DOT: Record<HighlightColor, string> = {
  yellow: '#F5C518',
  green: '#1E8A5B',
  blue: '#3B82F6',
  pink: '#EC4899',
};

type SavedVerse = {
  book: string;
  chapter: number;
  verse: number;
  bookmarked: boolean;
  highlightColor: HighlightColor | null;
  date: string;
};

export default function BookmarksScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { translation } = useBibleTranslation();
  const [saved, setSaved] = useState<SavedVerse[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([getAllBookmarks(db), getAllHighlights(db)]).then(([bookmarks, highlights]) => {
        if (cancelled) return;
        const byKey = new Map<string, SavedVerse>();
        for (const b of bookmarks) {
          const key = `${b.book}|${b.chapter}|${b.verse}`;
          byKey.set(key, { book: b.book, chapter: b.chapter, verse: b.verse, bookmarked: true, highlightColor: null, date: b.created_date });
        }
        for (const h of highlights) {
          const key = `${h.book}|${h.chapter}|${h.verse}`;
          const existing = byKey.get(key);
          if (existing) {
            existing.highlightColor = h.color;
            if (h.created_date > existing.date) existing.date = h.created_date;
          } else {
            byKey.set(key, { book: h.book, chapter: h.chapter, verse: h.verse, bookmarked: false, highlightColor: h.color, date: h.created_date });
          }
        }
        setSaved([...byKey.values()].sort((a, b) => (a.date < b.date ? 1 : -1)));
      });
      return () => {
        cancelled = true;
      };
    }, [db])
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={[]}>
      <FlatList
        data={saved}
        keyExtractor={(item) => `${item.book}|${item.chapter}|${item.verse}`}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: theme.spacing.xxl, gap: theme.spacing.sm }}>
            <BookmarkIcon size={32} color={theme.colors.textFaint} strokeWidth={1.5} />
            <Heading style={{ fontSize: theme.fontSize.md }}>No saved verses yet</Heading>
            <Body style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
              Tap a verse number to bookmark it, or long-press a verse to highlight it.
            </Body>
          </View>
        }
        renderItem={({ item }) => (
          <PressableScale
            onPress={() =>
              router.push({
                pathname: '/bible/[book]/[chapter]',
                params: { book: item.book, chapter: String(item.chapter), verse: String(item.verse) },
              })
            }
            scaleTo={0.99}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.lg,
                padding: theme.spacing.md,
                marginBottom: theme.spacing.sm,
                ...theme.shadow.subtle,
              }}
            >
              {item.bookmarked && (
                <BookmarkIcon size={16} color={theme.colors.accent} fill={theme.colors.accent} strokeWidth={1.5} />
              )}
              {item.highlightColor && (
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: HIGHLIGHT_DOT[item.highlightColor],
                    marginLeft: item.bookmarked ? theme.spacing.xs : 0,
                  }}
                />
              )}
              <Body
                style={{
                  marginLeft: theme.spacing.sm,
                  fontFamily: theme.fontFamily.sansSemiBold,
                }}
              >
                {getLocalizedBookName(translation, item.book)} {item.chapter}:{item.verse}
              </Body>
            </View>
          </PressableScale>
        )}
      />
    </SafeAreaView>
  );
}
