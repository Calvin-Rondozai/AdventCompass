import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Palette, X } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getQuarterData, SabbathDay, SabbathQuarterData } from '@/database/sabbathSchool';
import { findScriptureRefs } from '@/database/scriptureRefs';
import { getSabbathAnswers, saveSabbathAnswer } from '@/database/sabbathAnswers';
import { getSabbathHighlights, toggleSabbathHighlightColor } from '@/database/sabbathHighlights';
import { HIGHLIGHT_COLORS, HIGHLIGHT_HEX, HighlightColor } from '@/database/highlights';
import { VersePopup, VerseRef } from '@/components/bible/VersePopup';
import { Collapsible } from '@/components/sabbath/Collapsible';
import { DiscussionQuestionCard } from '@/components/sabbath/DiscussionQuestionCard';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Heading, Label } from '@/components/ui/Typography';

const DAY_NAMES = ['Sabbath', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SCREEN_WIDTH = Dimensions.get('window').width;

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

const MEMORY_TEXT_RE = /^Memory Text:\s*/i;
const ADDITIONAL_READING_RE = /^Additional Reading/i;

export default function SabbathLessonReaderScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const { id, week: rawWeek, day: dayParam } = useLocalSearchParams<{ id: string; week: string; day?: string }>();
  const weekNumber = Number(rawWeek);
  const [quarter, setQuarter] = useState<SabbathQuarterData | null>(null);
  const [popupRef, setPopupRef] = useState<VerseRef>(null);
  const [activeDay, setActiveDay] = useState(0);
  const appliedInitialDay = useRef(false);
  const [answers, setAnswers] = useState<Map<number, string>>(new Map());
  const [highlights, setHighlights] = useState<Map<number, HighlightColor>>(new Map());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showColorRow, setShowColorRow] = useState(false);
  const listRef = useRef<FlatList<SabbathDay>>(null);
  const answerTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const swatchHex = HIGHLIGHT_HEX[theme.scheme];
  const isSelecting = selected.size > 0;

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
    setSelected(new Set());
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
      if (!quarter) return;
      const day = lesson?.days[activeDay]?.day;
      if (day == null) return;
      const targets = [...selected];
      const allSameColor = targets.every((b) => highlights.get(b) === color);
      const next = new Map(highlights);
      for (const b of targets) {
        const current = next.get(b);
        if (allSameColor) {
          if (current === color) {
            await toggleSabbathHighlightColor(db, quarter.id, weekNumber, day, b, color);
            next.delete(b);
          }
        } else if (current === color) {
          // already correct
        } else if (current) {
          await toggleSabbathHighlightColor(db, quarter.id, weekNumber, day, b, current);
          await toggleSabbathHighlightColor(db, quarter.id, weekNumber, day, b, color);
          next.set(b, color);
        } else {
          await toggleSabbathHighlightColor(db, quarter.id, weekNumber, day, b, color);
          next.set(b, color);
        }
      }
      setHighlights(next);
      clearSelection();
    },
    [db, quarter, lesson, activeDay, selected, highlights, clearSelection]
  );

  if (!lesson) return null;

  const renderBlock = (block: SabbathDay['blocks'][number], index: number) => {
    const color = highlights.get(index);
    const isSelected = selected.has(index);

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

    const wrap = (content: React.ReactNode) => (
      <PressableScale
        key={index}
        onPress={() => isSelecting && toggleSelected(index)}
        onLongPress={() => toggleSelected(index)}
        scaleTo={0.995}
      >
        <View
          style={{
            backgroundColor: color ? swatchHex[color] : 'transparent',
            borderRadius: theme.radius.sm,
            borderWidth: isSelected ? 2 : 0,
            borderColor: theme.colors.primary,
            marginBottom: theme.spacing.sm,
            padding: color || isSelected ? theme.spacing.xs : 0,
          }}
        >
          {content}
        </View>
      </PressableScale>
    );

    if (block.type === 'heading') {
      return wrap(
        <Body
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

    if (block.type === 'quote') {
      const isMemoryText = MEMORY_TEXT_RE.test(block.text);
      const body = isMemoryText ? block.text.replace(MEMORY_TEXT_RE, '') : block.text;
      return wrap(
        <View
          style={{
            borderLeftWidth: 3,
            borderLeftColor: theme.colors.accent,
            backgroundColor: theme.colors.accentSoft,
            borderRadius: theme.radius.sm,
            padding: theme.spacing.sm + 2,
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
            {renderBlockText(body, theme.colors.onAccent, setPopupRef)}
          </Body>
        </View>
      );
    }

    return wrap(
      <Body
        style={{
          fontFamily: theme.fontFamily.serifRegular,
          fontSize: theme.fontSize.md,
          lineHeight: theme.lineHeight.lg,
          textAlign: 'justify',
        }}
      >
        {renderBlockText(block.text, theme.colors.primary, setPopupRef)}
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
