import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FlatList, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Palette, X } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getQuarterData, SabbathDay, SabbathQuarterData } from '@/database/sabbathSchool';
import { findScriptureRefs } from '@/database/scriptureRefs';
import { getSabbathAnswers, saveSabbathAnswer } from '@/database/sabbathAnswers';
import { addSabbathHighlight, getSabbathHighlights, removeSabbathHighlight, SabbathHighlight } from '@/database/sabbathHighlights';
import { HIGHLIGHT_COLORS, HIGHLIGHT_HEX, HighlightColor } from '@/database/highlights';
import { VersePopup, VerseRef } from '@/components/bible/VersePopup';
import { Collapsible } from '@/components/sabbath/Collapsible';
import { DiscussionQuestionCard } from '@/components/sabbath/DiscussionQuestionCard';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Heading, Label } from '@/components/ui/Typography';

const DAY_NAMES = ['Sabbath', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Lesson prose is full of scripture references ("John 3:16", "Rom. 5:8") — make each one
// tappable so it pops up right here instead of navigating away and leaving the lesson.
function renderBlockText(text: string, linkColor: string, onPressRef: (ref: VerseRef) => void) {
  const refs = findScriptureRefs(text);
  if (refs.length === 0) return text;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  refs.forEach((ref, i) => {
    if (ref.start > cursor) nodes.push(text.slice(cursor, ref.start));
    nodes.push(
      <Body
        key={i}
        style={{ color: linkColor, textDecorationLine: 'underline' }}
        onPress={() => onPressRef({ book: ref.book, chapter: ref.chapter, verse: ref.verse, verseEnd: ref.verseEnd })}
      >
        {ref.text}
      </Body>
    );
    cursor = ref.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function tokenizeWords(text: string): { word: string; start: number; end: number }[] {
  const tokens: { word: string; start: number; end: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) tokens.push({ word: m[0], start: m.index, end: m.index + m[0].length });
  return tokens;
}

// Renders one block word-by-word so a highlight can cover just the words the user picked
// instead of the whole paragraph, while scripture references stay tappable as a unit —
// a word inside a reference always opens the verse popup rather than joining a selection.
function renderHighlightableBlock(
  text: string,
  blockIndex: number,
  opts: {
    linkColor: string;
    pendingColor: string;
    blockHighlights: SabbathHighlight[];
    swatchHex: Record<HighlightColor, string>;
    anchorWord: number | null;
    pendingRange: { start: number; end: number } | null;
    onPressRef: (ref: VerseRef) => void;
    onWordPress: (blockIndex: number, wordIndex: number) => void;
    onWordLongPress: (blockIndex: number, wordIndex: number) => void;
  }
) {
  const { linkColor, pendingColor, blockHighlights, swatchHex, anchorWord, pendingRange, onPressRef, onWordPress, onWordLongPress } = opts;
  const refs = findScriptureRefs(text);
  const words = tokenizeWords(text);

  const highlightColorFor = (wordIndex: number): string | undefined => {
    // Ranges can overlap (see the ponytail note on applyHighlight) — last match wins.
    let color: HighlightColor | undefined;
    for (const h of blockHighlights) {
      const covered = h.startWord === -1 || (wordIndex >= h.startWord && wordIndex <= h.endWord);
      if (covered) color = h.color;
    }
    return color ? swatchHex[color] : undefined;
  };

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  words.forEach((tok, wordIndex) => {
    if (tok.start > cursor) nodes.push(text.slice(cursor, tok.start));
    const ref = refs.find((r) => tok.start < r.end && tok.end > r.start);
    const isPending = pendingRange ? wordIndex >= pendingRange.start && wordIndex <= pendingRange.end : wordIndex === anchorWord;
    nodes.push(
      <Body
        key={wordIndex}
        onPress={() => (ref ? onPressRef({ book: ref.book, chapter: ref.chapter, verse: ref.verse, verseEnd: ref.verseEnd }) : onWordPress(blockIndex, wordIndex))}
        onLongPress={() => !ref && onWordLongPress(blockIndex, wordIndex)}
        style={{
          color: ref ? linkColor : undefined,
          textDecorationLine: ref ? 'underline' : 'none',
          backgroundColor: isPending ? pendingColor : highlightColorFor(wordIndex),
        }}
      >
        {tok.word}
      </Body>
    );
    cursor = tok.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

const MEMORY_TEXT_RE = /^Memory Text:\s*/i;
const ADDITIONAL_READING_RE = /^Additional Reading/i;

export default function SabbathLessonReaderScreen() {
  const theme = useTheme();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const { id, week: rawWeek, day: dayParam } = useLocalSearchParams<{ id: string; week: string; day?: string }>();
  const weekNumber = Number(rawWeek);
  const [quarter, setQuarter] = useState<SabbathQuarterData | null>(null);
  const [popupRef, setPopupRef] = useState<VerseRef>(null);
  const [activeDay, setActiveDay] = useState(0);
  const appliedInitialDay = useRef(false);
  const [answers, setAnswers] = useState<Map<number, string>>(new Map());
  const [highlights, setHighlights] = useState<Map<number, SabbathHighlight[]>>(new Map());
  const [anchor, setAnchor] = useState<{ block: number; word: number } | null>(null);
  const [pending, setPending] = useState<{ block: number; start: number; end: number } | null>(null);
  const [showColorRow, setShowColorRow] = useState(false);
  const listRef = useRef<FlatList<SabbathDay>>(null);
  const answerTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const swatchHex = HIGHLIGHT_HEX[theme.scheme];
  const isSelecting = anchor != null || pending != null;

  useEffect(() => {
    if (id) getQuarterData(db, id).then(setQuarter);
  }, [db, id]);

  const lesson = quarter?.lessons.find((l) => l.week === weekNumber);

  // Deep-links from the dashboard ("today's lesson") name an exact day — jump straight to
  // its page once the lesson has loaded, instead of always opening on Sabbath.
  useEffect(() => {
    if (!lesson || appliedInitialDay.current) return;
    appliedInitialDay.current = true;
    if (!dayParam) return;
    const idx = lesson.days.findIndex((d) => d.day === Number(dayParam));
    if (idx > 0) {
      setActiveDay(idx);
      requestAnimationFrame(() => listRef.current?.scrollToIndex({ index: idx, animated: false }));
    }
  }, [lesson, dayParam]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: lesson ? `Lesson ${lesson.week}` : '' });
  }, [navigation, lesson]);

  // Answers/highlights are keyed by (quarter, week, day) — reload whenever the visible
  // page changes, and drop any in-progress paragraph selection from the day just left.
  useEffect(() => {
    if (!quarter) return;
    const day = lesson?.days[activeDay]?.day;
    if (day == null) return;
    setAnchor(null);
    setPending(null);
    setShowColorRow(false);
    getSabbathAnswers(db, quarter.id, weekNumber, day).then(setAnswers);
    getSabbathHighlights(db, quarter.id, weekNumber, day).then(setHighlights);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, quarter?.id, weekNumber, activeDay]);

  const handleAnswerChange = (dayNumber: number, blockIndex: number, text: string) => {
    setAnswers((prev) => new Map(prev).set(blockIndex, text));
    if (!quarter) return;
    clearTimeout(answerTimers.current.get(blockIndex));
    const timer = setTimeout(() => {
      saveSabbathAnswer(db, quarter.id, weekNumber, dayNumber, blockIndex, text);
    }, 500);
    answerTimers.current.set(blockIndex, timer);
  };

  const clearSelection = useCallback(() => {
    setAnchor(null);
    setPending(null);
    setShowColorRow(false);
  }, []);

  // First tap on a word anchors the selection; a second tap in the same block confirms
  // the range and opens the color row. Tapping while a range is already pending is a
  // no-op — clear it with the X button first, rather than silently restarting it.
  const handleWordPress = useCallback(
    (blockIndex: number, wordIndex: number) => {
      if (pending) return;
      if (!anchor || anchor.block !== blockIndex) {
        setAnchor({ block: blockIndex, word: wordIndex });
        return;
      }
      setPending({ block: blockIndex, start: Math.min(anchor.word, wordIndex), end: Math.max(anchor.word, wordIndex) });
      setAnchor(null);
    },
    [anchor, pending]
  );

  // Long-pressing a word that's part of an existing highlight removes just that range.
  const handleWordLongPress = useCallback(
    async (blockIndex: number, wordIndex: number) => {
      const blockHighlights = highlights.get(blockIndex) ?? [];
      const hit = blockHighlights.find((h) => h.startWord === -1 || (wordIndex >= h.startWord && wordIndex <= h.endWord));
      if (!hit) return;
      await removeSabbathHighlight(db, hit.id);
      setHighlights((prev) => {
        const next = new Map(prev);
        next.set(blockIndex, (next.get(blockIndex) ?? []).filter((h) => h.id !== hit.id));
        return next;
      });
    },
    [db, highlights]
  );

  // ponytail: overlapping ranges within a block are allowed to stack rather than being
  // trimmed/merged against existing highlights — renderHighlightableBlock just lets the
  // last-inserted range win per word. Add merge-on-overlap if that ever looks wrong.
  const applyHighlight = useCallback(
    async (color: HighlightColor) => {
      if (!quarter || !pending) return;
      const day = lesson?.days[activeDay]?.day;
      if (day == null) return;
      const id = await addSabbathHighlight(db, quarter.id, weekNumber, day, pending.block, pending.start, pending.end, color);
      setHighlights((prev) => {
        const next = new Map(prev);
        next.set(pending.block, [...(next.get(pending.block) ?? []), { id, startWord: pending.start, endWord: pending.end, color }]);
        return next;
      });
      clearSelection();
    },
    [db, quarter, lesson, activeDay, pending, clearSelection]
  );

  if (!lesson) return null;

  const renderBlock = (block: SabbathDay['blocks'][number], index: number) => {
    if (block.type === 'question') {
      return (
        <DiscussionQuestionCard
          key={index}
          question={renderBlockText(block.text, theme.colors.primary, setPopupRef)}
          answer={answers.get(index) ?? ''}
          onChangeAnswer={(text) => handleAnswerChange(lesson.days[activeDay].day, index, text)}
        />
      );
    }

    if (block.type === 'heading') {
      return (
        <Body
          key={index}
          style={{
            fontFamily: theme.fontFamily.sansSemiBold,
            fontSize: theme.fontSize.base,
            marginTop: theme.spacing.sm,
            marginBottom: theme.spacing.xs,
          }}
        >
          {block.text}
        </Body>
      );
    }

    const highlightOpts = {
      pendingColor: theme.colors.primarySoft,
      blockHighlights: highlights.get(index) ?? [],
      swatchHex,
      anchorWord: anchor?.block === index ? anchor.word : null,
      pendingRange: pending?.block === index ? pending : null,
      onPressRef: setPopupRef,
      onWordPress: handleWordPress,
      onWordLongPress: handleWordLongPress,
    };

    if (block.type === 'quote') {
      const isMemoryText = MEMORY_TEXT_RE.test(block.text);
      const body = isMemoryText ? block.text.replace(MEMORY_TEXT_RE, '') : block.text;
      return (
        <View
          key={index}
          style={{
            borderLeftWidth: 3,
            borderLeftColor: theme.colors.accent,
            backgroundColor: theme.colors.accentSoft,
            borderRadius: theme.radius.sm,
            padding: theme.spacing.sm + 2,
            marginBottom: theme.spacing.sm,
          }}
        >
          {isMemoryText && (
            <Body style={{ fontFamily: theme.fontFamily.sansBold, color: theme.colors.onAccent, marginBottom: 4 }}>
              Memory Text:
            </Body>
          )}
          <Body
            style={{
              fontFamily: theme.fontFamily.serifItalic,
              fontSize: theme.fontSize.base,
              lineHeight: theme.lineHeight.base,
              color: theme.colors.onAccent,
            }}
          >
            {renderHighlightableBlock(body, index, { ...highlightOpts, linkColor: theme.colors.onAccent })}
          </Body>
        </View>
      );
    }

    return (
      <Body
        key={index}
        style={{
          fontFamily: theme.fontFamily.serifRegular,
          fontSize: theme.fontSize.md,
          lineHeight: theme.lineHeight.lg,
          textAlign: 'justify',
          marginBottom: theme.spacing.sm,
        }}
      >
        {renderHighlightableBlock(block.text, index, { ...highlightOpts, linkColor: theme.colors.primary })}
      </Body>
    );
  };

  const renderDayBlocks = (day: SabbathDay) => {
    const nodes: React.ReactNode[] = [];
    let i = 0;
    while (i < day.blocks.length) {
      const block = day.blocks[i];
      if (block.type === 'heading' && ADDITIONAL_READING_RE.test(block.text)) {
        const group: { block: SabbathDay['blocks'][number]; index: number }[] = [];
        let j = i + 1;
        while (j < day.blocks.length && day.blocks[j].type !== 'heading') {
          group.push({ block: day.blocks[j], index: j });
          j++;
        }
        nodes.push(
          <Collapsible key={i} title={block.text}>
            {group.map(({ block: b, index: bi }) => renderBlock(b, bi))}
          </Collapsible>
        );
        i = j;
        continue;
      }
      nodes.push(renderBlock(block, i));
      i++;
    }
    return nodes;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, gap: theme.spacing.sm }}
      >
        {lesson.days.map((day, i) => (
          <PressableScale
            key={day.day}
            onPress={() => {
              listRef.current?.scrollToIndex({ index: i, animated: true });
              setActiveDay(i);
            }}
            scaleTo={0.96}
          >
            <View
              style={{
                paddingVertical: theme.spacing.xs + 2,
                paddingHorizontal: theme.spacing.sm + 2,
                borderRadius: theme.radius.pill,
                backgroundColor: activeDay === i ? theme.colors.primary : theme.colors.surfaceMuted,
              }}
            >
              <Body
                style={{
                  fontSize: theme.fontSize.sm,
                  color: activeDay === i ? theme.colors.onPrimary : theme.colors.textMuted,
                  fontFamily: theme.fontFamily.sansMedium,
                }}
              >
                {DAY_NAMES[day.day - 1] ?? `Day ${day.day}`}
              </Body>
            </View>
          </PressableScale>
        ))}
      </ScrollView>

      <FlatList
        ref={listRef}
        data={lesson.days}
        keyExtractor={(d) => String(d.day)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        // Word-level highlighting (see renderHighlightableBlock) renders one tappable node
        // per word, so a whole day's content is hundreds of elements — FlatList's default
        // windowSize (21) would happily mount all 7 days at once despite only one being
        // visible. Capping it to the current page plus one neighbor either side is what
        // actually keeps opening a lesson fast.
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        windowSize={3}
        getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setActiveDay(idx);
        }}
        renderItem={({ item: day }) => (
          <ScrollView
            style={{ width: SCREEN_WIDTH }}
            contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
          >
            <Label style={{ color: theme.colors.primary, marginBottom: 2 }}>
              {DAY_NAMES[day.day - 1] ?? `Day ${day.day}`} · {day.date}
            </Label>
            <Heading style={{ fontSize: theme.fontSize.lg, marginBottom: theme.spacing.sm }}>{day.title}</Heading>
            {renderDayBlocks(day)}
          </ScrollView>
        )}
      />

      {isSelecting && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            padding: theme.spacing.md,
          }}
        >
          {showColorRow && pending && (
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
              {pending
                ? `${pending.end - pending.start + 1} word${pending.end > pending.start ? 's' : ''} selected`
                : 'Tap the last word to finish selecting'}
            </Body>
            {pending && (
              <PressableScale onPress={() => setShowColorRow((v) => !v)} style={{ padding: theme.spacing.xs }}>
                <Palette size={20} color={theme.colors.primary} strokeWidth={1.75} />
              </PressableScale>
            )}
            <PressableScale onPress={clearSelection} style={{ padding: theme.spacing.xs }}>
              <X size={20} color={theme.colors.textMuted} strokeWidth={1.75} />
            </PressableScale>
          </View>
        </View>
      )}

      <VersePopup reference={popupRef} onClose={() => setPopupRef(null)} />
    </SafeAreaView>
  );
}
