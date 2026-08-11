import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Volume2 } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getQuarterData, SabbathDay, SabbathQuarterData } from '@/database/sabbathSchool';
import { findScriptureRefs } from '@/database/scriptureRefs';
import { getSabbathAnswers, saveSabbathAnswer } from '@/database/sabbathAnswers';
import { addSabbathHighlight, getSabbathHighlights, removeSabbathHighlight, SabbathHighlight } from '@/database/sabbathHighlights';
import { HighlightColor } from '@/database/highlights';
import { useReadAloud } from '@/hooks/useReadAloud';
import { prefetchVoices } from '@/services/speechEngine';
import { splitForSpeech } from '@/utils/speechText';
import { VersePopup, VerseRef } from '@/components/bible/VersePopup';
import { PageLoader } from '@/components/ui/PageLoader';
import { Collapsible } from '@/components/sabbath/Collapsible';
import { DiscussionQuestionCard } from '@/components/sabbath/DiscussionQuestionCard';
import { PressableScale } from '@/components/ui/PressableScale';
import { ReadAloudBar } from '@/components/reader/ReadAloudBar';
import { VoiceSettingsSheet } from '@/components/reader/VoiceSettingsSheet';
import { HighlightableText } from '@/components/reader/HighlightableText';
import { HighlightActionBar } from '@/components/reader/HighlightActionBar';
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
  const [pending, setPending] = useState<{ block: number; start: number; end: number } | null>(null);
  const listRef = useRef<FlatList<SabbathDay>>(null);
  const answerTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const isSelecting = pending != null;

  const [readAloudOpen, setReadAloudOpen] = useState(false);
  const [voiceSettingsOpen, setVoiceSettingsOpen] = useState(false);
  const readAloud = useReadAloud();
  const activeScrollRef = useRef<ScrollView>(null);
  const activeBlockLayouts = useRef<Map<number, number>>(new Map());

  // toggleReadAloudOpen/handleCloseReadAloud deliberately depend on readAloud.stop,
  // not the whole readAloud object — see the equivalent note in the other three
  // readers: the object's identity changes on every block transition during active
  // playback, and toggleReadAloudOpen sits in the header's navigation.setOptions()
  // useLayoutEffect deps below.
  const toggleReadAloudOpen = useCallback(() => {
    setReadAloudOpen((v) => {
      if (v) readAloud.stop();
      return !v;
    });
  }, [readAloud.stop]);

  // Prefetched on mount rather than only when the bar opens — see the equivalent note
  // in the Bible reader — so the native voice enumeration (1–3+ seconds on Android) has
  // the whole time this lesson is open to finish before Read Aloud's settings sheet
  // is ever actually reached.
  useEffect(() => {
    prefetchVoices().catch(() => {});
  }, []);

  const handleCloseReadAloud = useCallback(() => {
    readAloud.stop();
    setReadAloudOpen(false);
  }, [readAloud.stop]);

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
    navigation.setOptions({
      title: lesson ? `Lesson ${lesson.week}` : '',
      headerRight: () => (
        <PressableScale onPress={toggleReadAloudOpen} style={{ padding: theme.spacing.xs }}>
          <Volume2 size={18} color={readAloudOpen ? theme.colors.primary : theme.colors.text} />
        </PressableScale>
      ),
    });
  }, [navigation, lesson, theme, readAloudOpen, toggleReadAloudOpen]);

  const activeDayBlocks = lesson?.days[activeDay]?.blocks ?? [];
  const readAloudChunks = useMemo(
    () =>
      activeDayBlocks.flatMap((block, i) => {
        if (block.type === 'quote' && MEMORY_TEXT_RE.test(block.text)) {
          return splitForSpeech(String(i), `Memory text. ${block.text.replace(MEMORY_TEXT_RE, '')}`);
        }
        return splitForSpeech(String(i), block.text);
      }),
    [activeDayBlocks]
  );

  // A different lesson, week, or day means the old queue no longer matches what's
  // on screen.
  useEffect(() => {
    readAloud.stop();
    setReadAloudOpen(false);
    activeBlockLayouts.current = new Map();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quarter?.id, weekNumber, activeDay]);

  const handleReadAloudPlayPause = useCallback(() => {
    if (readAloud.state === 'speaking') readAloud.pause();
    else if (readAloud.state === 'paused') readAloud.resume();
    else readAloud.play(readAloudChunks);
  }, [readAloud.state, readAloud.pause, readAloud.resume, readAloud.play, readAloudChunks]);

  useEffect(() => {
    if (!readAloud.activeKey) return;
    const y = activeBlockLayouts.current.get(Number(readAloud.activeKey));
    if (y != null) activeScrollRef.current?.scrollTo({ y: Math.max(0, y - theme.spacing.lg * 2), animated: true });
  }, [readAloud.activeKey, theme.spacing.lg]);

  // Answers/highlights are keyed by (quarter, week, day) — reload whenever the visible
  // page changes, and drop any in-progress paragraph selection from the day just left.
  useEffect(() => {
    if (!quarter) return;
    const day = lesson?.days[activeDay]?.day;
    if (day == null) return;
    setPending(null);
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
    setPending(null);
  }, []);

  // Fires once a HighlightableText drag-selection finishes — see that component for how
  // pressing and holding a word, then dragging, replaces the old two-tap scheme.
  const handleSelectionEnd = useCallback((blockIndex: number, start: number, end: number) => {
    setPending({ block: blockIndex, start, end });
  }, []);

  const overlappingHighlights = pending
    ? (highlights.get(pending.block) ?? []).filter(
        (h) => h.startWord === -1 || (h.startWord <= pending.end && h.endWord >= pending.start)
      )
    : [];

  const removeOverlapping = useCallback(async () => {
    if (!pending) return;
    await Promise.all(overlappingHighlights.map((h) => removeSabbathHighlight(db, h.id)));
    setHighlights((prev) => {
      const next = new Map(prev);
      const ids = new Set(overlappingHighlights.map((h) => h.id));
      next.set(pending.block, (next.get(pending.block) ?? []).filter((h) => !ids.has(h.id)));
      return next;
    });
    clearSelection();
  }, [db, pending, overlappingHighlights, clearSelection]);

  // ponytail: overlapping ranges within a block are allowed to stack rather than being
  // trimmed/merged against existing highlights — HighlightableText just lets the
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

  if (!lesson) return <PageLoader />;

  const renderBlock = (block: SabbathDay['blocks'][number], index: number, isActiveDay: boolean) => {
    const isSpeaking = isActiveDay && readAloud.activeKey === String(index);

    let content: React.ReactNode;
    if (block.type === 'question') {
      content = (
        <DiscussionQuestionCard
          question={renderBlockText(block.text, theme.colors.primary, setPopupRef)}
          answer={answers.get(index) ?? ''}
          onChangeAnswer={(text) => handleAnswerChange(lesson.days[activeDay].day, index, text)}
        />
      );
    } else if (block.type === 'heading') {
      content = (
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
    } else {
      const blockHighlights = highlights.get(index) ?? [];
      const pendingRange = pending?.block === index ? { start: pending.start, end: pending.end } : null;

      if (block.type === 'quote') {
        const isMemoryText = MEMORY_TEXT_RE.test(block.text);
        const body = isMemoryText ? block.text.replace(MEMORY_TEXT_RE, '') : block.text;
        content = (
          <View
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
            <HighlightableText
              text={body}
              blockIndex={index}
              highlights={blockHighlights}
              pendingRange={pendingRange}
              pendingColor={theme.colors.primarySoft}
              linkColor={theme.colors.onAccent}
              textStyle={{
                fontFamily: theme.fontFamily.serifItalic,
                fontSize: theme.fontSize.base,
                lineHeight: theme.lineHeight.base,
                color: theme.colors.onAccent,
              }}
              onPressRef={setPopupRef}
              onSelectionEnd={handleSelectionEnd}
            />
          </View>
        );
      } else {
        content = (
          <View style={{ marginBottom: theme.spacing.sm }}>
            <HighlightableText
              text={block.text}
              blockIndex={index}
              highlights={blockHighlights}
              pendingRange={pendingRange}
              pendingColor={theme.colors.primarySoft}
              linkColor={theme.colors.primary}
              textStyle={{
                fontFamily: theme.fontFamily.serifRegular,
                fontSize: theme.fontSize.md,
                lineHeight: theme.lineHeight.lg,
                color: theme.colors.text,
              }}
              onPressRef={setPopupRef}
              onSelectionEnd={handleSelectionEnd}
            />
          </View>
        );
      }
    }

    return (
      <View
        key={index}
        onLayout={isActiveDay ? (e) => activeBlockLayouts.current.set(index, e.nativeEvent.layout.y) : undefined}
        style={
          isSpeaking
            ? {
                backgroundColor: theme.colors.primarySoft,
                borderRadius: theme.radius.sm,
                borderWidth: 1,
                borderColor: theme.colors.primary,
                padding: theme.spacing.xs,
                marginBottom: theme.spacing.xs,
              }
            : undefined
        }
      >
        {content}
      </View>
    );
  };

  const renderDayBlocks = (day: SabbathDay, isActiveDay: boolean) => {
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
            {group.map(({ block: b, index: bi }) => renderBlock(b, bi, isActiveDay))}
          </Collapsible>
        );
        i = j;
        continue;
      }
      nodes.push(renderBlock(block, i, isActiveDay));
      i++;
    }
    return nodes;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.xs, paddingBottom: theme.spacing.xs, gap: theme.spacing.sm }}
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
        // Without an explicit flex, this horizontal FlatList has no deterministic height to
        // lay out against — it was sizing itself off an initial measurement pass of its first
        // rendered day (a nested vertical ScrollView with no height of its own either), then
        // re-laying-out once that settled. That's exactly the "blank space that appears then
        // disappears" seen the first time a lesson opens, and the same missing height is what
        // let the gap above it read as bigger than the pill row's own (now-tightened) padding
        // would suggest. flex: 1 makes it claim all remaining vertical space immediately, on
        // the very first frame, so there's nothing left to settle into.
        style={{ flex: 1 }}
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
        renderItem={({ item: day, index }) => {
          const isActiveDay = index === activeDay;
          return (
            <ScrollView
              ref={isActiveDay ? activeScrollRef : undefined}
              style={{ width: SCREEN_WIDTH }}
              contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
            >
              <Label style={{ color: theme.colors.primary, marginBottom: 2 }}>
                {DAY_NAMES[day.day - 1] ?? `Day ${day.day}`} · {day.date}
              </Label>
              <Heading style={{ fontSize: theme.fontSize.lg, marginBottom: theme.spacing.sm }}>{day.title}</Heading>
              {renderDayBlocks(day, isActiveDay)}
            </ScrollView>
          );
        }}
      />

      {isSelecting && pending && (
        <HighlightActionBar
          wordCount={pending.end - pending.start + 1}
          hasExistingHighlight={overlappingHighlights.length > 0}
          onPickColor={applyHighlight}
          onRemove={removeOverlapping}
          onCancel={clearSelection}
        />
      )}

      {!isSelecting && readAloudOpen && (
        <ReadAloudBar
          state={readAloud.state}
          label={
            readAloud.activeKey
              ? `Reading block ${Number(readAloud.activeKey) + 1}`
              : `Read ${DAY_NAMES[lesson.days[activeDay]?.day - 1] ?? 'this day'} aloud`
          }
          onPlayPause={handleReadAloudPlayPause}
          onSkipBack={() => readAloud.skip(-1)}
          onSkipForward={() => readAloud.skip(1)}
          onOpenSettings={() => setVoiceSettingsOpen(true)}
          onClose={handleCloseReadAloud}
        />
      )}

      <VersePopup reference={popupRef} onClose={() => setPopupRef(null)} />
      <VoiceSettingsSheet
        visible={voiceSettingsOpen}
        rate={readAloud.rate}
        onSelectRate={readAloud.setRate}
        voice={readAloud.voice}
        onSelectVoice={readAloud.setVoice}
        onClose={() => setVoiceSettingsOpen(false)}
      />
    </SafeAreaView>
  );
}
