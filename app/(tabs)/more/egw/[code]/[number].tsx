import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ChevronLeft, ChevronRight, NotebookPen, Palette, X } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { EgwBook, getEgwBook } from '@/database/egwBooks';
import { getEgwHighlightsForChapter, toggleEgwHighlightColor } from '@/database/egwHighlights';
import { HIGHLIGHT_COLORS, HIGHLIGHT_HEX, HighlightColor } from '@/database/highlights';
import { PageLoader } from '@/components/ui/PageLoader';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Heading, Label } from '@/components/ui/Typography';

// Page markers like "[123]" are kept in the scraped text so the reader can show the
// original book's pagination — split them out at render time into small "[Page N]"
// badges instead of leaving raw brackets sitting in the middle of a sentence.
function renderPageMarkers(text: string, mutedColor: string) {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    if (!m) return part;
    return (
      <Body key={i} style={{ fontSize: 11, fontWeight: '600', color: mutedColor }}>
        {' '}
        [Page {m[1]}]{' '}
      </Body>
    );
  });
}

// Compilation books (Testimonies, Child Guidance, etc.) lead many paragraphs with a
// short bolded sub-heading before an em dash — "The Child's First Textbook--The Bible
// should be..." — render that lead-in bold like the original print, instead of running
// it into the paragraph as plain text.
const SUBTITLE_RE = /^([A-Z][A-Za-z0-9,'".:;() ]{2,80}?)--(.+)$/s;

// Printed books signal a new paragraph with a first-line indent, not blog-style vertical
// gaps between blocks — React Native's Text has no `textIndent`, so a short run of
// non-breaking spaces at the start of the line is the standard workaround. The very first
// paragraph of a chapter (and any subtitled lead-in, which already reads as its own block)
// stays flush, matching how printed books never indent the opening paragraph either.
const PARAGRAPH_INDENT = '      ';

function renderParagraph(text: string, mutedColor: string, boldFont: string) {
  const m = text.match(SUBTITLE_RE);
  if (!m) return renderPageMarkers(text, mutedColor);
  return [
    <Body key="sub" style={{ fontFamily: boldFont }}>
      {m[1]}--
    </Body>,
    ...renderPageMarkers(m[2], mutedColor),
  ];
}

export default function EgwChapterReaderScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const { code, number } = useLocalSearchParams<{ code: string; number: string }>();
  const [book, setBook] = useState<EgwBook | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  // getEgwBook reads the book's chapters straight from SQLite (loaded once at migration
  // time from the bundled .datjson assets — see database/egwBooks.ts) rather than
  // re-parsing a multi-megabyte JSON asset on every open.
  useEffect(() => {
    if (!code) return;
    setBook(undefined);
    setFailed(false);
    let cancelled = false;
    getEgwBook(db, code)
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
  const chapterNumber = Number(number);
  const chapter = book?.chapters.find((c) => c.number === chapterNumber);
  const prevChapter = book?.chapters.find((c) => c.number === chapterNumber - 1);
  const nextChapter = book?.chapters.find((c) => c.number === chapterNumber + 1);
  const paragraphs = useMemo(() => chapter?.content.split('\n\n') ?? [], [chapter]);
  const swatchHex = HIGHLIGHT_HEX[theme.scheme];

  const [highlights, setHighlights] = useState<Map<number, HighlightColor>>(new Map());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showColorRow, setShowColorRow] = useState(false);
  const isSelecting = selected.size > 0;

  useFocusEffect(
    useCallback(() => {
      if (!code || !chapterNumber) return;
      getEgwHighlightsForChapter(db, code, chapterNumber).then(setHighlights);
    }, [db, code, chapterNumber])
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: book?.title ?? '' });
  }, [navigation, book]);

  const toggleSelected = useCallback((i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setShowColorRow(false);
  }, []);

  const applyHighlight = useCallback(
    async (color: HighlightColor) => {
      if (!code) return;
      const targets = [...selected];
      const allSameColor = targets.every((p) => highlights.get(p) === color);
      const next = new Map(highlights);
      for (const p of targets) {
        const current = next.get(p);
        if (allSameColor) {
          if (current === color) {
            await toggleEgwHighlightColor(db, code, chapterNumber, p, color);
            next.delete(p);
          }
        } else if (current === color) {
          // already correct
        } else if (current) {
          await toggleEgwHighlightColor(db, code, chapterNumber, p, current);
          await toggleEgwHighlightColor(db, code, chapterNumber, p, color);
          next.set(p, color);
        } else {
          await toggleEgwHighlightColor(db, code, chapterNumber, p, color);
          next.set(p, color);
        }
      }
      setHighlights(next);
      clearSelection();
    },
    [db, code, chapterNumber, selected, highlights, clearSelection]
  );

  const addNoteFromSelection = useCallback(() => {
    if (!book || !chapter) return;
    const sorted = [...selected].sort((a, b) => a - b);
    const label =
      sorted.length > 1
        ? `${book.title}, Ch. ${chapter.number} ¶${sorted[0] + 1}-${sorted[sorted.length - 1] + 1}`
        : `${book.title}, Ch. ${chapter.number} ¶${sorted[0] + 1}`;
    clearSelection();
    router.push({
      pathname: '/notes/[id]',
      params: { id: 'new', linkedVerse: label, category: 'reflection' },
    });
  }, [book, chapter, selected, clearSelection]);

  if (failed) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg }}>
        <Body style={{ color: theme.colors.textMuted, textAlign: 'center', marginBottom: theme.spacing.md }}>
          This chapter couldn't be loaded.
        </Body>
        <PressableScale onPress={() => setRetryToken((n) => n + 1)}>
          <Body style={{ color: theme.colors.primary, fontFamily: theme.fontFamily.sansSemiBold }}>Try again</Body>
        </PressableScale>
      </SafeAreaView>
    );
  }

  if (!book || !chapter) return <PageLoader />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <View style={{ alignItems: 'center', marginBottom: theme.spacing.lg }}>
          <Label style={{ marginBottom: 4, letterSpacing: 1 }}>CHAPTER {chapter.number}</Label>
          <Heading style={{ textAlign: 'center' }}>{chapter.title}</Heading>
          <View style={{ width: 48, height: 2, borderRadius: 1, backgroundColor: theme.colors.border, marginTop: theme.spacing.sm }} />
        </View>
        {paragraphs.map((para, i) => {
          const color = highlights.get(i);
          const isSelected = selected.has(i);
          // Printed books indent every paragraph after the first to mark a new one, rather
          // than a blog-style gap between blocks — a subtitled lead-in ("The Child's First
          // Textbook--...") already reads as its own block via renderParagraph's bold lead,
          // so it stays flush like the opening paragraph does.
          const showIndent = i > 0 && !SUBTITLE_RE.test(para);
          return (
            <PressableScale
              key={i}
              onPress={() => isSelecting && toggleSelected(i)}
              onLongPress={() => toggleSelected(i)}
              scaleTo={0.995}
            >
              <View
                style={{
                  backgroundColor: color ? swatchHex[color] : 'transparent',
                  borderRadius: theme.radius.sm,
                  borderWidth: isSelected ? 2 : 0,
                  borderColor: theme.colors.primary,
                  padding: color || isSelected ? theme.spacing.xs : 0,
                }}
              >
                <Body
                  style={{
                    fontFamily: theme.fontFamily.serifRegular,
                    fontSize: theme.fontSize.md,
                    lineHeight: theme.lineHeight.lg,
                    textAlign: 'justify',
                  }}
                >
                  {showIndent ? PARAGRAPH_INDENT : ''}
                  {renderParagraph(para, theme.colors.textFaint, theme.fontFamily.serifBold)}
                </Body>
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>

      {isSelecting && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            padding: theme.spacing.md,
          }}
        >
          {showColorRow && (
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
              {HIGHLIGHT_COLORS.map((c) => (
                <PressableScale key={c} onPress={() => applyHighlight(c)} scaleTo={0.85}>
                  <View style={{ width: 32, height: 32, borderRadius: theme.radius.pill, backgroundColor: swatchHex[c] }} />
                </PressableScale>
              ))}
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Body style={{ flex: 1, color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
              {selected.size} paragraph{selected.size > 1 ? 's' : ''} selected
            </Body>
            <PressableScale onPress={() => setShowColorRow((v) => !v)} style={{ padding: theme.spacing.xs }}>
              <Palette size={20} color={theme.colors.primary} strokeWidth={1.75} />
            </PressableScale>
            <PressableScale onPress={addNoteFromSelection} style={{ padding: theme.spacing.xs }}>
              <NotebookPen size={20} color={theme.colors.primary} strokeWidth={1.75} />
            </PressableScale>
            <PressableScale onPress={clearSelection} style={{ padding: theme.spacing.xs }}>
              <X size={20} color={theme.colors.textMuted} strokeWidth={1.75} />
            </PressableScale>
          </View>
        </View>
      )}

      {!isSelecting && (
        <View
          style={{
            flexDirection: 'row',
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          }}
        >
          <PressableScale
            disabled={!prevChapter}
            onPress={() =>
              prevChapter &&
              router.replace({ pathname: '/more/egw/[code]/[number]', params: { code: code ?? '', number: String(prevChapter.number) } })
            }
            style={{ flex: 1, opacity: prevChapter ? 1 : 0.35 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: theme.spacing.md }}>
              <ChevronLeft size={16} color={theme.colors.text} />
              <Body style={{ marginLeft: 4, fontSize: theme.fontSize.sm }} numberOfLines={1}>
                {prevChapter?.title ?? 'Start'}
              </Body>
            </View>
          </PressableScale>
          <View style={{ width: 1, backgroundColor: theme.colors.border }} />
          <PressableScale
            disabled={!nextChapter}
            onPress={() =>
              nextChapter &&
              router.replace({ pathname: '/more/egw/[code]/[number]', params: { code: code ?? '', number: String(nextChapter.number) } })
            }
            style={{ flex: 1, opacity: nextChapter ? 1 : 0.35 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: theme.spacing.md }}>
              <Body style={{ marginRight: 4, fontSize: theme.fontSize.sm }} numberOfLines={1}>
                {nextChapter?.title ?? 'End'}
              </Body>
              <ChevronRight size={16} color={theme.colors.text} />
            </View>
          </PressableScale>
        </View>
      )}
    </SafeAreaView>
  );
}
