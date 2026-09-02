import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { useTheme } from '@/theme/ThemeProvider';
import { BIBLE_BOOKS, BibleBook } from '@/database/bibleBooks';
import { getChapterVerseCount } from '@/database/bible';
import { getLocalizedBookName } from '@/database/bookNames';
import { useBibleTranslation } from '@/hooks/useBibleTranslation';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Label } from '@/components/ui/Typography';

type PickerTab = 'book' | 'chapter' | 'verse';
const TABS: { key: PickerTab; label: string }[] = [
  { key: 'book', label: 'BOOK' },
  { key: 'chapter', label: 'CHAPTER' },
  { key: 'verse', label: 'VERSE' },
];

export default function ReferencePickerScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const db = useSQLiteContext();
  const { translation } = useBibleTranslation();
  const { book: rawBook, chapter: rawChapter } = useLocalSearchParams<{ book: string; chapter?: string }>();

  // Task deep-links (the chapter header tap, the book list, search's "go to book") all hit
  // this same route — always land on CHAPTER (the most common entry point), pre-selecting
  // the book from the URL, and pre-highlighting the chapter too when one was passed in.
  const [activeTab, setActiveTab] = useState<PickerTab>('chapter');
  const [selectedBook, setSelectedBook] = useState(() => decodeURIComponent(rawBook ?? ''));
  const [selectedChapter, setSelectedChapter] = useState<number | null>(() => (rawChapter ? Number(rawChapter) : null));
  const [verseCount, setVerseCount] = useState(0);

  // Re-sync when this same route is re-entered with different params (e.g. tapping a
  // different chapter's header, or "go to book" from search) rather than remounting.
  useEffect(() => {
    setSelectedBook(decodeURIComponent(rawBook ?? ''));
    setSelectedChapter(rawChapter ? Number(rawChapter) : null);
    setActiveTab('chapter');
  }, [rawBook, rawChapter]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'References' });
  }, [navigation]);

  const bookInfo = useMemo(() => BIBLE_BOOKS.find((b) => b.name === selectedBook), [selectedBook]);
  const chapters = useMemo(() => Array.from({ length: bookInfo?.chapters ?? 0 }, (_, i) => i + 1), [bookInfo]);

  useEffect(() => {
    let cancelled = false;
    if (activeTab !== 'verse' || selectedChapter == null || !selectedBook) return;
    getChapterVerseCount(db, translation, selectedBook, selectedChapter).then((count) => {
      if (!cancelled) setVerseCount(count);
    });
    return () => {
      cancelled = true;
    };
  }, [db, translation, selectedBook, selectedChapter, activeTab]);

  const handleSelectBook = useCallback((name: string) => {
    setSelectedBook(name);
    setSelectedChapter(null);
    setActiveTab('chapter');
  }, []);

  // Primary flow matches the reference: BOOK -> CHAPTER -> VERSE, one tap at a time —
  // tapping a chapter number moves on to the VERSE tab instead of jumping straight into
  // the reading screen. Long-pressing skips verse selection for anyone who just wants the
  // chapter (the old primary behavior), kept as a quick shortcut.
  const handleSelectChapter = useCallback((chapter: number) => {
    setSelectedChapter(chapter);
    setActiveTab('verse');
  }, []);

  const handleQuickJumpToChapter = useCallback((chapter: number) => {
    router.push({ pathname: '/bible/[book]/[chapter]', params: { book: selectedBook, chapter: String(chapter) } });
  }, [selectedBook]);

  const handleSelectVerse = useCallback((verse: number) => {
    if (selectedChapter == null) return;
    router.push({
      pathname: '/bible/[book]/[chapter]',
      params: { book: selectedBook, chapter: String(selectedChapter), verse: String(verse) },
    });
  }, [selectedBook, selectedChapter]);

  const { width: windowWidth } = useWindowDimensions();
  const gridPadding = theme.spacing.lg * 2;
  const bookColumns = 4;
  const bookGap = theme.spacing.sm;
  const bookCellWidth = (windowWidth - gridPadding - bookGap * (bookColumns - 1)) / bookColumns;
  // Same column count as the verse grid below so chapterCellSize === verseCellSize —
  // chapter and verse circles need to render at identical diameters.
  const chapterColumns = 6;
  const chapterGap = theme.spacing.sm;
  const chapterCellSize = (windowWidth - gridPadding - chapterGap * (chapterColumns - 1)) / chapterColumns;
  const verseColumns = 6;
  const verseGap = theme.spacing.sm;
  const verseCellSize = (windowWidth - gridPadding - verseGap * (verseColumns - 1)) / verseColumns;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={[]}>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: theme.colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{ flex: 1, alignItems: 'center', paddingVertical: theme.spacing.md }}
            >
              <Label style={{ color: isActive ? theme.colors.accent : theme.colors.textMuted }}>{tab.label}</Label>
              <View
                style={{
                  marginTop: theme.spacing.xs,
                  height: 2,
                  width: '60%',
                  borderRadius: theme.radius.pill,
                  backgroundColor: isActive ? theme.colors.accent : 'transparent',
                }}
              />
            </Pressable>
          );
        })}
      </View>

      {activeTab === 'book' && (
        <FlatList
          data={BIBLE_BOOKS}
          keyExtractor={(item) => item.name}
          numColumns={bookColumns}
          contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
          columnWrapperStyle={{ gap: bookGap }}
          renderItem={({ item }) => (
            <BookPill
              book={item}
              width={bookCellWidth}
              label={getLocalizedBookName(translation, item.name)}
              isSelected={item.name === selectedBook}
              onPress={() => handleSelectBook(item.name)}
            />
          )}
        />
      )}

      {activeTab === 'chapter' && (
        <FlatList
          data={chapters}
          keyExtractor={(n) => String(n)}
          numColumns={chapterColumns}
          contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
          columnWrapperStyle={{ gap: chapterGap }}
          ListHeaderComponent={
            selectedBook ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: theme.spacing.md,
                }}
              >
                <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }}>
                  {getLocalizedBookName(translation, selectedBook)}
                </Body>
                <Label style={{ color: theme.colors.textFaint }}>Hold to jump straight in</Label>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isCurrent = selectedChapter === item;
            return (
              <PressableScale
                onPress={() => handleSelectChapter(item)}
                onLongPress={() => handleQuickJumpToChapter(item)}
                scaleTo={0.94}
                style={{ width: chapterCellSize, marginBottom: theme.spacing.sm }}
              >
                <View
                  style={{
                    width: chapterCellSize,
                    height: chapterCellSize,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isCurrent ? theme.colors.primary : theme.colors.surface,
                    borderRadius: theme.radius.pill,
                    ...theme.shadow.subtle,
                  }}
                >
                  <Body
                    style={{
                      fontFamily: theme.fontFamily.sansSemiBold,
                      color: isCurrent ? theme.colors.onPrimary : theme.colors.text,
                    }}
                  >
                    {item}
                  </Body>
                </View>
              </PressableScale>
            );
          }}
        />
      )}

      {activeTab === 'verse' && (
        selectedChapter == null ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg }}>
            <Body style={{ color: theme.colors.textMuted, textAlign: 'center', marginBottom: theme.spacing.lg }}>
              Choose a chapter first, then come back to jump straight to a verse.
            </Body>
            <PressableScale onPress={() => setActiveTab('chapter')} scaleTo={0.97}>
              <View
                style={{
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radius.md,
                  paddingVertical: theme.spacing.sm + 2,
                  paddingHorizontal: theme.spacing.lg,
                }}
              >
                <Body style={{ color: theme.colors.onPrimary, fontFamily: theme.fontFamily.sansSemiBold }}>
                  Pick a Chapter
                </Body>
              </View>
            </PressableScale>
          </View>
        ) : (
          <FlatList
            data={Array.from({ length: verseCount }, (_, i) => i + 1)}
            keyExtractor={(n) => String(n)}
            numColumns={verseColumns}
            contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
            columnWrapperStyle={{ gap: verseGap }}
            ListHeaderComponent={
              <Body style={{ fontFamily: theme.fontFamily.sansSemiBold, marginBottom: theme.spacing.md }}>
                {getLocalizedBookName(translation, selectedBook)} {selectedChapter}
              </Body>
            }
            renderItem={({ item }) => (
              <PressableScale
                onPress={() => handleSelectVerse(item)}
                scaleTo={0.9}
                style={{ width: verseCellSize, marginBottom: theme.spacing.sm }}
              >
                <View
                  style={{
                    width: verseCellSize,
                    height: verseCellSize,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.colors.surfaceMuted,
                    borderRadius: theme.radius.pill,
                  }}
                >
                  <Body style={{ fontFamily: theme.fontFamily.sansSemiBold, fontSize: theme.fontSize.sm }}>{item}</Body>
                </View>
              </PressableScale>
            )}
          />
        )
      )}
    </SafeAreaView>
  );
}

function BookPill({
  book,
  width,
  label,
  isSelected,
  onPress,
}: {
  book: BibleBook;
  width: number;
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const isNew = book.testament === 'new';
  const softBg = isNew ? theme.colors.accentSoft : theme.colors.primarySoft;
  const solidBg = isNew ? theme.colors.accent : theme.colors.primary;
  const softText = isNew ? theme.colors.accent : theme.colors.primary;
  const solidText = isNew ? theme.colors.onAccent : theme.colors.onPrimary;

  return (
    <PressableScale onPress={onPress} scaleTo={0.94} style={{ width, marginBottom: theme.spacing.sm }}>
      <View
        style={{
          minHeight: 48,
          width,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: theme.spacing.xs,
          paddingVertical: theme.spacing.xs,
          borderRadius: theme.radius.pill,
          backgroundColor: isSelected ? solidBg : softBg,
        }}
      >
        <Body
          numberOfLines={2}
          style={{
            textAlign: 'center',
            fontFamily: theme.fontFamily.sansSemiBold,
            fontSize: theme.fontSize.xs,
            color: isSelected ? solidText : softText,
          }}
        >
          {label}
        </Body>
      </View>
    </PressableScale>
  );
}
