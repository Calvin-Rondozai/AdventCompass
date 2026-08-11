import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { useTheme } from '@/theme/ThemeProvider';
import { getCommentaryChapter } from '@/database/sdaCommentary';
import { VersePopup, VerseRef } from '@/components/bible/VersePopup';
import { useReadAloud } from '@/hooks/useReadAloud';
import { prefetchVoices } from '@/services/speechEngine';
import { splitForSpeech } from '@/utils/speechText';
import { HighlightColor } from '@/database/highlights';
import { addWordHighlight, getWordHighlights, removeWordHighlight, WordHighlight } from '@/database/wordHighlights';
import { ArrowLeft, Volume2 } from '@/components/ui/Icon';
import { PageLoader } from '@/components/ui/PageLoader';
import { PressableScale } from '@/components/ui/PressableScale';
import { ReadAloudBar } from '@/components/reader/ReadAloudBar';
import { VoiceSettingsSheet } from '@/components/reader/VoiceSettingsSheet';
import { HighlightableText } from '@/components/reader/HighlightableText';
import { HighlightActionBar } from '@/components/reader/HighlightActionBar';
import { Heading, Label } from '@/components/ui/Typography';

export default function CommentaryEntriesScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const db = useSQLiteContext();
  const { book: rawBook, chapter: rawChapter, fromVerse } = useLocalSearchParams<{
    book: string;
    chapter: string;
    fromVerse?: string;
  }>();
  const book = decodeURIComponent(rawBook ?? '');
  const chapterNumber = Number(rawChapter);
  const chapter = useMemo(() => getCommentaryChapter(book, chapterNumber), [book, chapterNumber]);
  const [popupRef, setPopupRef] = useState<VerseRef>(null);

  const contentKey = `${book}|${chapterNumber}`;
  const [highlights, setHighlights] = useState<Map<number, WordHighlight[]>>(new Map());
  const [pending, setPending] = useState<{ block: number; start: number; end: number } | null>(null);

  useEffect(() => {
    setPending(null);
    getWordHighlights(db, 'commentary', contentKey).then(setHighlights);
  }, [db, contentKey]);

  const handleSelectionEnd = useCallback((block: number, start: number, end: number) => {
    setPending({ block, start, end });
  }, []);

  const overlapping = pending
    ? (highlights.get(pending.block) ?? []).filter((h) => h.startWord <= pending.end && h.endWord >= pending.start)
    : [];

  const applyColor = useCallback(
    async (color: HighlightColor) => {
      if (!pending) return;
      const id = await addWordHighlight(db, 'commentary', contentKey, pending.block, pending.start, pending.end, color);
      setHighlights((prev) => {
        const next = new Map(prev);
        next.set(pending.block, [...(next.get(pending.block) ?? []), { id, blockIndex: pending.block, startWord: pending.start, endWord: pending.end, color }]);
        return next;
      });
      setPending(null);
    },
    [db, contentKey, pending]
  );

  const applyRemove = useCallback(async () => {
    if (!pending) return;
    await Promise.all(overlapping.map((h) => removeWordHighlight(db, h.id)));
    setHighlights((prev) => {
      const next = new Map(prev);
      const ids = new Set(overlapping.map((h) => h.id));
      next.set(pending.block, (next.get(pending.block) ?? []).filter((h) => !ids.has(h.id)));
      return next;
    });
    setPending(null);
  }, [db, pending, overlapping]);

  const [readAloudOpen, setReadAloudOpen] = useState(false);
  const [voiceSettingsOpen, setVoiceSettingsOpen] = useState(false);
  const readAloud = useReadAloud();
  const readAloudChunks = useMemo(
    () =>
      (chapter?.entries ?? []).flatMap((entry, i) => {
        const label = entry.verseStart === entry.verseEnd ? `Verse ${entry.verseStart}.` : `Verses ${entry.verseStart} to ${entry.verseEnd}.`;
        return splitForSpeech(String(i), `${label} ${entry.content}`);
      }),
    [chapter]
  );

  useEffect(() => {
    readAloud.stop();
    setReadAloudOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, chapterNumber]);

  // toggleReadAloudOpen/handleCloseReadAloud deliberately depend on readAloud.stop,
  // not the whole readAloud object — see the equivalent note in the Bible/EGW
  // readers: the object's identity changes on every entry transition during active
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
  // the whole time this chapter is open to finish before Read Aloud's settings sheet
  // is ever actually reached.
  useEffect(() => {
    prefetchVoices().catch(() => {});
  }, []);

  const handleReadAloudPlayPause = useCallback(() => {
    if (readAloud.state === 'speaking') readAloud.pause();
    else if (readAloud.state === 'paused') readAloud.resume();
    else readAloud.play(readAloudChunks);
  }, [readAloud.state, readAloud.pause, readAloud.resume, readAloud.play, readAloudChunks]);

  const handleCloseReadAloud = useCallback(() => {
    readAloud.stop();
    setReadAloudOpen(false);
  }, [readAloud.stop]);

  const scrollRef = useRef<ScrollView>(null);
  const entryLayouts = useRef<Map<number, number>>(new Map());
  useEffect(() => {
    if (!readAloud.activeKey) return;
    const y = entryLayouts.current.get(Number(readAloud.activeKey));
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - theme.spacing.lg * 2), animated: true });
  }, [readAloud.activeKey, theme.spacing.lg]);

  // Reached from the Bible tab by pushing into this (separate) tab's own stack —
  // the default back button would pop within *this* stack's history, landing on
  // the More menu instead of the verse this was opened from. Two things that look
  // right here but aren't: dismissTo() only resolves against the *current* stack's
  // own route names, so a cross-tab target is a silent no-op (StackRouter's POP_TO
  // handler). dismissAll()/POP_TO_TOP computes how many screens to pop from the
  // stack's current depth — if this was reached as the More tab's very first-ever
  // screen (depth 1, nothing above the root to pop), there's nothing for it to do
  // and React Navigation reports it as unhandled. replace() doesn't count anything —
  // it just swaps the current screen for another one in the same stack — so it
  // works regardless of how deep the More stack happens to be. Then navigate() (not
  // push()) switches to the Bible tab and re-focuses its chapter screen, which was
  // never touched and is still sitting there, instead of pushing a duplicate.
  //
  // This same function backs BOTH the header's back arrow AND the hardware/gesture
  // back button below — previously only the arrow ran this, so the phone's back
  // button fell through to the default stack pop (landing on the More menu) instead
  // of matching what the arrow did. Every custom back handler in this app should be
  // wired to both the same way.
  const goBackToVerse = useCallback(() => {
    if (!fromVerse) return;
    router.replace('/more');
    router.navigate({
      pathname: '/bible/[book]/[chapter]',
      params: { book, chapter: String(chapterNumber), verse: fromVerse },
    });
  }, [fromVerse, book, chapterNumber]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: `${book} ${chapterNumber}`,
      headerLeft: fromVerse
        ? () => (
            <PressableScale onPress={goBackToVerse} style={{ padding: theme.spacing.xs }}>
              <ArrowLeft size={22} color={theme.colors.text} strokeWidth={2} />
            </PressableScale>
          )
        : undefined,
      headerRight: () => (
        <PressableScale onPress={toggleReadAloudOpen} style={{ padding: theme.spacing.xs }}>
          <Volume2 size={18} color={readAloudOpen ? theme.colors.primary : theme.colors.text} />
        </PressableScale>
      ),
    });
  }, [navigation, book, chapterNumber, fromVerse, theme, goBackToVerse, readAloudOpen, toggleReadAloudOpen]);

  useEffect(() => {
    if (!fromVerse) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBackToVerse();
      return true;
    });
    return () => sub.remove();
  }, [fromVerse, goBackToVerse]);

  if (!chapter) return <PageLoader />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Heading style={{ marginBottom: theme.spacing.md }}>
          {book} {chapter.number}
        </Heading>
        {chapter.entries.map((entry, i) => {
          const isSpeaking = readAloud.activeKey === String(i);
          return (
            <View
              key={i}
              onLayout={(e) => entryLayouts.current.set(i, e.nativeEvent.layout.y)}
              style={{
                marginBottom: theme.spacing.md,
                backgroundColor: isSpeaking ? theme.colors.primarySoft : 'transparent',
                borderRadius: theme.radius.sm,
                borderWidth: isSpeaking ? 1 : 0,
                borderColor: theme.colors.primary,
                padding: isSpeaking ? theme.spacing.xs : 0,
              }}
            >
              <Label style={{ marginBottom: 2 }}>
                {entry.verseStart === entry.verseEnd ? `Verse ${entry.verseStart}` : `Verses ${entry.verseStart}-${entry.verseEnd}`}
              </Label>
              <HighlightableText
                text={entry.content}
                blockIndex={i}
                highlights={highlights.get(i) ?? []}
                pendingRange={pending?.block === i ? { start: pending.start, end: pending.end } : null}
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
        })}
      </ScrollView>

      {pending ? (
        <HighlightActionBar
          wordCount={pending.end - pending.start + 1}
          hasExistingHighlight={overlapping.length > 0}
          onPickColor={applyColor}
          onRemove={applyRemove}
          onCancel={() => setPending(null)}
        />
      ) : (
        readAloudOpen && (
          <ReadAloudBar
            state={readAloud.state}
            label={readAloud.activeKey ? `Reading entry ${Number(readAloud.activeKey) + 1}` : `Read chapter ${chapter.number} aloud`}
            onPlayPause={handleReadAloudPlayPause}
            onSkipBack={() => readAloud.skip(-1)}
            onSkipForward={() => readAloud.skip(1)}
            onOpenSettings={() => setVoiceSettingsOpen(true)}
            onClose={handleCloseReadAloud}
          />
        )
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
