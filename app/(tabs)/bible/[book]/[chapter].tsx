import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { runOnJS } from 'react-native-reanimated';
import { ArrowLeft, Bookmark, Columns, ChevronDown, Languages, Library, Link2, NotebookPen, Palette, Volume2, X } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getChapterVerses, Verse } from '@/database/bible';
import { getAdjacentChapter } from '@/database/bibleBooks';
import { getBookmarksForChapter, toggleBookmark } from '@/database/bookmarks';
import { getHighlightsForChapter, toggleHighlightColor, HIGHLIGHT_COLORS, HighlightColor } from '@/database/highlights';
import { formatVerseRefMulti, getNotesForVerse, getVersesWithNotes } from '@/database/notes';
import { getCrossReferences } from '@/database/crossReferences';
import { getCommentaryVersesForChapter } from '@/database/sdaCommentary';
import { getLocalizedBookName } from '@/database/bookNames';
import { useReadingPosition } from '@/hooks/useReadingPosition';
import { useBibleTranslation } from '@/hooks/useBibleTranslation';
import { useTabBarVisibility } from '@/hooks/useTabBarVisibility';
import { useReadAloud } from '@/hooks/useReadAloud';
import { prefetchVoices } from '@/services/speechEngine';
import { synthesizeChunksToFile } from '@/services/ttsFileEngine';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerProvider';
import { PressableScale } from '@/components/ui/PressableScale';
import { TranslationSheet } from '@/components/bible/TranslationSheet';
import { ReadAloudBar } from '@/components/reader/ReadAloudBar';
import { VoiceSettingsSheet } from '@/components/reader/VoiceSettingsSheet';
import { showAlert } from '@/components/ui/AppAlert';
import { Body, Label } from '@/components/ui/Typography';

const HIGHLIGHT_HEX: Record<'light' | 'dark', Record<HighlightColor, string>> = {
  light: { yellow: '#FEF3C7', green: '#D1FAE5', blue: '#DBEAFE', pink: '#FCE7F3' },
  dark: { yellow: '#4A3B12', green: '#0F3D2E', blue: '#0F2A4A', pink: '#3D1530' },
};

export default function ChapterReaderScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const { setPosition } = useReadingPosition();
  const { translation, setTranslation } = useBibleTranslation();
  const { setVisible: setTabBarVisible } = useTabBarVisibility();
  const { book: rawBook, chapter: rawChapter, verse: rawVerse } = useLocalSearchParams<{
    book: string;
    chapter: string;
    verse?: string;
  }>();
  const book = decodeURIComponent(rawBook ?? '');
  const chapter = Number(rawChapter);
  const targetVerse = rawVerse ? Number(rawVerse) : null;

  const scrollRef = useRef<ScrollView>(null);
  const verseLayouts = useRef<Map<number, number>>(new Map());
  const [flashVerse, setFlashVerse] = useState<number | null>(null);

  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState<Set<number>>(new Set());
  const [highlights, setHighlights] = useState<Map<number, HighlightColor>>(new Map());
  const [versesWithNotes, setVersesWithNotes] = useState<Set<number>>(new Set());
  const [selectedVerses, setSelectedVerses] = useState<Set<number>>(new Set());
  const [showColorRow, setShowColorRow] = useState(false);
  const [showVersionSheet, setShowVersionSheet] = useState(false);
  const [compareTranslation, setCompareTranslation] = useState<string | null>(null);
  const [compareVerses, setCompareVerses] = useState<Map<number, string>>(new Map());
  const [showCompareSheet, setShowCompareSheet] = useState(false);
  const [crossRefVerse, setCrossRefVerse] = useState<number | null>(null);
  const [commentaryVerses, setCommentaryVerses] = useState<Set<number>>(new Set());
  const [readAloudOpen, setReadAloudOpen] = useState(false);
  const [voiceSettingsOpen, setVoiceSettingsOpen] = useState(false);
  const [renderProgress, setRenderProgress] = useState<{ done: number; total: number } | null>(null);
  const readAloud = useReadAloud();
  const audioPlayer = useAudioPlayerContext();
  const toggleReadAloudOpen = useCallback(() => {
    setReadAloudOpen((v) => {
      if (v) readAloud.stop();
      return !v;
    });
    // Deliberately depends on readAloud.stop, not the whole readAloud object — that
    // object's identity changes on every verse transition during active playback
    // (state/activeKey are part of it), and this callback sits in the header's
    // navigation.setOptions() useLayoutEffect deps below. Depending on the whole
    // object meant the header was being torn down and rebuilt on every single verse
    // while reading, which is exactly the kind of continuous work that both slows
    // the app down and adds enough JS-thread jitter to make the TTS engine's own
    // timing (see useReadAloud.ts) less reliable.
  }, [readAloud.stop]);

  const isSelecting = selectedVerses.size > 0;

  const prevRef = getAdjacentChapter(book, chapter, 'prev');
  const nextRef = getAdjacentChapter(book, chapter, 'next');
  const swatchHex = HIGHLIGHT_HEX[theme.scheme];

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/bible');
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [goBack]);

  useLayoutEffect(() => {
    const localizedBook = getLocalizedBookName(translation, book);
    navigation.setOptions({
      title: `${localizedBook} ${chapter}`,
      headerBackTitle: localizedBook,
      // When this screen is reached via a deep link from another tab (Devotions, a
      // reading plan, a note), this stack has no prior entry, so the default back
      // button is absent — always provide a way back to the book list. The hardware
      // back button above is wired to the exact same goBack() so both always agree.
      headerLeft: () => (
        <PressableScale onPress={goBack} style={{ padding: theme.spacing.xs }}>
          <ArrowLeft size={22} color={theme.colors.text} strokeWidth={2} />
        </PressableScale>
      ),
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <PressableScale onPress={toggleReadAloudOpen} style={{ padding: theme.spacing.xs }}>
            <Volume2 size={18} color={readAloudOpen ? theme.colors.primary : theme.colors.text} />
          </PressableScale>
          <PressableScale
            onPress={() => (compareTranslation ? setCompareTranslation(null) : setShowCompareSheet(true))}
            style={{ padding: theme.spacing.xs }}
          >
            <Columns size={18} color={compareTranslation ? theme.colors.primary : theme.colors.text} />
          </PressableScale>
        </View>
      ),
    });
  }, [navigation, book, chapter, translation, theme, compareTranslation, goBack, readAloudOpen, toggleReadAloudOpen]);

  // Restore the tab bar whenever this screen loses focus or unmounts, so it doesn't
  // stay hidden after navigating away mid-scroll.
  useEffect(() => {
    return () => setTabBarVisible(true);
  }, [setTabBarVisible]);

  // Previously this only fired once the read-aloud bar itself was opened (a clearer
  // signal of intent), but that left the native voice-enumeration call — 1–3+ seconds
  // on Android — still in flight when someone opened the bar and went straight for its
  // settings gear, so the Read Aloud sheet rendered with an empty/"loading" voice list
  // for however much of that window was left. Starting it here instead, the moment this
  // screen mounts, gives it the whole time the chapter is being read to finish, so by
  // the time Read Aloud (and its settings) is actually opened it's already cached.
  useEffect(() => {
    prefetchVoices().catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [rows, bookmarkSet, highlightMap, noteVerses] = await Promise.all([
          getChapterVerses(db, translation, book, chapter),
          getBookmarksForChapter(db, book, chapter),
          getHighlightsForChapter(db, book, chapter),
          getVersesWithNotes(db, book, chapter),
        ]);
        if (cancelled) return;
        setVerses(rows);
        setBookmarked(bookmarkSet);
        setHighlights(highlightMap);
        setVersesWithNotes(noteVerses);
        setCommentaryVerses(getCommentaryVersesForChapter(book, chapter));
        setPosition({ book, chapter });
      } catch (error) {
        if (!cancelled) console.error('Failed to load chapter', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    setSelectedVerses(new Set());
    setShowColorRow(false);
    // A new chapter/translation means the old read-aloud queue no longer matches
    // what's on screen — stop rather than let it keep reading stale verses.
    readAloud.stop();
    setReadAloudOpen(false);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, translation, book, chapter, setPosition]);

  // Scroll to and briefly flash-highlight a verse when this screen was reached via a
  // deep link that names one (a cross-reference, a devotional verse, a search result).
  // Verse rows aren't laid out yet on the same tick verses are set, so wait a beat for
  // onLayout to have recorded their y-positions before scrolling.
  useEffect(() => {
    if (targetVerse == null || verses.length === 0) return;
    const scrollTimer = setTimeout(() => {
      const y = verseLayouts.current.get(targetVerse);
      if (y != null) {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - theme.spacing.lg * 2), animated: true });
      }
      setFlashVerse(targetVerse);
    }, 150);
    const clearTimer = setTimeout(() => setFlashVerse(null), 2500);
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verses, targetVerse]);

  useEffect(() => {
    let cancelled = false;
    if (!compareTranslation) {
      setCompareVerses(new Map());
      return;
    }
    getChapterVerses(db, compareTranslation, book, chapter).then((rows) => {
      if (cancelled) return;
      setCompareVerses(new Map(rows.map((r) => [r.verse, r.text])));
    });
    return () => {
      cancelled = true;
    };
  }, [db, compareTranslation, book, chapter]);

  const toggleVerseSelected = useCallback((verse: number) => {
    setSelectedVerses((prev) => {
      const next = new Set(prev);
      if (next.has(verse)) next.delete(verse);
      else next.add(verse);
      return next;
    });
  }, []);

  const handleVersePress = useCallback(
    (verse: number) => {
      if (isSelecting) toggleVerseSelected(verse);
    },
    [isSelecting, toggleVerseSelected]
  );

  const clearSelection = useCallback(() => {
    setSelectedVerses(new Set());
    setShowColorRow(false);
  }, []);

  const handleToggleBookmark = useCallback(
    async (verse: number) => {
      const isNowBookmarked = await toggleBookmark(db, book, chapter, verse);
      setBookmarked((prev) => {
        const next = new Set(prev);
        if (isNowBookmarked) next.add(verse);
        else next.delete(verse);
        return next;
      });
    },
    [db, book, chapter]
  );

  const handleBookmarkSelection = useCallback(async () => {
    const versesToToggle = [...selectedVerses];
    const allBookmarked = versesToToggle.every((v) => bookmarked.has(v));
    for (const v of versesToToggle) {
      const isCurrentlyBookmarked = bookmarked.has(v);
      if (allBookmarked && isCurrentlyBookmarked) await toggleBookmark(db, book, chapter, v);
      else if (!allBookmarked && !isCurrentlyBookmarked) await toggleBookmark(db, book, chapter, v);
    }
    const nextBookmarked = new Set(bookmarked);
    if (allBookmarked) versesToToggle.forEach((v) => nextBookmarked.delete(v));
    else versesToToggle.forEach((v) => nextBookmarked.add(v));
    setBookmarked(nextBookmarked);
    clearSelection();
  }, [db, book, chapter, selectedVerses, bookmarked, clearSelection]);

  const handleHighlightSelection = useCallback(
    async (color: HighlightColor) => {
      const versesToApply = [...selectedVerses];
      const allSameColor = versesToApply.every((v) => highlights.get(v) === color);
      const nextHighlights = new Map(highlights);
      for (const v of versesToApply) {
        const current = highlights.get(v);
        if (allSameColor) {
          // Every selected verse already has this color — remove it from all.
          if (current === color) {
            await toggleHighlightColor(db, book, chapter, v, color);
            nextHighlights.delete(v);
          }
        } else {
          // Bring every selected verse to this color (toggling twice if it already
          // has a different color, since toggleHighlightColor only switches/removes
          // the one color passed in).
          if (current === color) {
            // already correct
          } else if (current) {
            await toggleHighlightColor(db, book, chapter, v, current);
            await toggleHighlightColor(db, book, chapter, v, color);
            nextHighlights.set(v, color);
          } else {
            await toggleHighlightColor(db, book, chapter, v, color);
            nextHighlights.set(v, color);
          }
        }
      }
      setHighlights(nextHighlights);
      clearSelection();
    },
    [db, book, chapter, selectedVerses, highlights, clearSelection]
  );

  useFocusEffect(
    useCallback(() => {
      getVersesWithNotes(db, book, chapter).then(setVersesWithNotes);
    }, [db, book, chapter])
  );

  const handleAddNoteFromSelection = useCallback(() => {
    const versesArr = [...selectedVerses];
    clearSelection();
    router.push({
      pathname: '/notes/[id]',
      params: { id: 'new', linkedVerse: formatVerseRefMulti(book, chapter, versesArr), category: 'bible_study' },
    });
  }, [book, chapter, selectedVerses, clearSelection]);

  const handleOpenNotes = useCallback(
    async (verse: number) => {
      const notes = await getNotesForVerse(db, `${book} ${chapter}:${verse}`);
      if (notes[0]) {
        router.push({ pathname: '/notes/[id]', params: { id: String(notes[0].id) } });
      }
    },
    [db, book, chapter]
  );

  const goToChapter = useCallback((ref: { book: string; chapter: number } | null) => {
    if (!ref) return;
    router.replace({ pathname: '/bible/[book]/[chapter]', params: { book: ref.book, chapter: String(ref.chapter) } });
  }, []);

  const readAloudChunks = useMemo(() => verses.map((v) => ({ key: String(v.verse), text: v.text })), [verses]);
  const backgroundTitle = useMemo(() => `${getLocalizedBookName(translation, book)} ${chapter}`, [translation, book, chapter]);

  const handleReadAloudPlayPause = useCallback(() => {
    if (readAloud.state === 'speaking') readAloud.pause();
    else if (readAloud.state === 'paused') readAloud.resume();
    else readAloud.play(readAloudChunks, targetVerse != null ? String(targetVerse) : undefined);
  }, [readAloud.state, readAloud.pause, readAloud.resume, readAloud.play, readAloudChunks, targetVerse]);

  // Renders this chapter to a file (real, roughly reading-length wall-clock time — see
  // ReadAloudBar's progress label) and hands it to the global player instead of speaking
  // it live, so it can keep playing in the background with a persistent mini player.
  const handlePlayInBackground = useCallback(async () => {
    if (renderProgress) return;
    try {
      setRenderProgress({ done: 0, total: readAloudChunks.length });
      const { file, chunkOffsets } = await synthesizeChunksToFile(
        readAloudChunks,
        backgroundTitle,
        { voice: readAloud.voice, rate: readAloud.rate },
        (done, total) => setRenderProgress({ done, total })
      );
      audioPlayer.play(file.uri, backgroundTitle, chunkOffsets);
    } catch (error) {
      console.error('Failed to render background audio', error);
      showAlert('Could not prepare audio', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setRenderProgress(null);
    }
  }, [renderProgress, readAloudChunks, backgroundTitle, readAloud.voice, readAloud.rate, audioPlayer]);

  const handleCloseReadAloud = useCallback(() => {
    readAloud.stop();
    setReadAloudOpen(false);
  }, [readAloud.stop]);

  // Keep the reading position on screen — same idea as the deep-link scroll-to-verse
  // effect above, but re-triggered every time speech (live or backgrounded) advances to
  // a new verse.
  const backgroundActiveKey = audioPlayer.nowPlaying?.title === backgroundTitle ? audioPlayer.activeKey : null;
  useEffect(() => {
    const key = readAloud.activeKey ?? backgroundActiveKey;
    if (!key) return;
    const y = verseLayouts.current.get(Number(key));
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - theme.spacing.lg * 2), animated: true });
  }, [readAloud.activeKey, backgroundActiveKey, theme.spacing.lg]);

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      'worklet';
      if (e.translationX < -60 && e.velocityX < 0) {
        runOnJS(goToChapter)(nextRef);
      } else if (e.translationX > 60 && e.velocityX > 0) {
        runOnJS(goToChapter)(prevRef);
      }
    });

  const lastScrollY = useRef(0);
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const delta = y - lastScrollY.current;
      if (delta > 8 && y > 40) setTabBarVisible(false);
      else if (delta < -8 || y <= 0) setTabBarVisible(true);
      lastScrollY.current = y;
    },
    [setTabBarVisible]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={[]}>
      <GestureDetector gesture={swipeGesture}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
          onScroll={handleScroll}
          scrollEventThrottle={32}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm, gap: theme.spacing.md }}>
            <PressableScale onPress={() => setShowVersionSheet(true)} scaleTo={0.97}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Languages size={14} color={theme.colors.textMuted} />
                <Label>{translation}</Label>
                <ChevronDown size={12} color={theme.colors.textMuted} />
              </View>
            </PressableScale>
            {/* Same toggle as the header's Columns icon — kept here too, labeled, since an
                unlabeled header icon is easy to miss as "the compare feature" entirely. */}
            <PressableScale
              onPress={() => (compareTranslation ? setCompareTranslation(null) : setShowCompareSheet(true))}
              scaleTo={0.97}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Columns size={14} color={theme.colors.primary} />
                <Label style={{ color: theme.colors.primary }}>{compareTranslation ? 'Exit compare' : 'Compare'}</Label>
              </View>
            </PressableScale>
            {compareTranslation && (
              <PressableScale onPress={() => setShowCompareSheet(true)} scaleTo={0.97}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Label style={{ color: theme.colors.primary }}>vs {compareTranslation}</Label>
                  <ChevronDown size={12} color={theme.colors.primary} />
                </View>
              </PressableScale>
            )}
          </View>
          {loading ? (
            <Body style={{ color: theme.colors.textMuted }}>Loading…</Body>
          ) : compareTranslation ? (
            verses.map((v) => (
              <View key={v.id} style={{ flexDirection: 'row', marginBottom: theme.spacing.md, gap: theme.spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Label style={{ marginBottom: 2 }}>{v.verse}</Label>
                  <Body
                    style={{
                      fontFamily: theme.fontFamily.serifRegular,
                      fontSize: theme.fontSize.sm,
                      lineHeight: theme.lineHeight.md,
                    }}
                  >
                    {v.text}
                  </Body>
                </View>
                <View style={{ width: 1, backgroundColor: theme.colors.border }} />
                <View style={{ flex: 1 }}>
                  <Label style={{ marginBottom: 2 }}>{v.verse}</Label>
                  <Body
                    style={{
                      fontFamily: theme.fontFamily.serifRegular,
                      fontSize: theme.fontSize.sm,
                      lineHeight: theme.lineHeight.md,
                      color: compareVerses.has(v.verse) ? theme.colors.text : theme.colors.textFaint,
                    }}
                  >
                    {compareVerses.get(v.verse) ?? '(no text)'}
                  </Body>
                </View>
              </View>
            ))
          ) : (
            verses.map((v) => {
              const isBookmarked = bookmarked.has(v.verse);
              const highlightColor = highlights.get(v.verse);
              const isSelected = selectedVerses.has(v.verse);
              const isFlashing = flashVerse === v.verse;
              const isBackgroundReading =
                audioPlayer.nowPlaying?.title === backgroundTitle && audioPlayer.activeKey === String(v.verse);
              const isSpeaking = readAloud.activeKey === String(v.verse) || isBackgroundReading;
              return (
                <View
                  key={v.id}
                  onLayout={(e) => verseLayouts.current.set(v.verse, e.nativeEvent.layout.y)}
                  style={{
                    flexDirection: 'row',
                    marginBottom: theme.spacing.sm,
                    backgroundColor: isFlashing || isSpeaking
                      ? theme.colors.primarySoft
                      : highlightColor
                        ? swatchHex[highlightColor]
                        : 'transparent',
                    borderRadius: theme.radius.sm,
                    borderWidth: isSelected ? 2 : isSpeaking ? 1 : 0,
                    borderColor: theme.colors.primary,
                  }}
                >
                  <PressableScale
                    onPress={() => (isSelecting ? toggleVerseSelected(v.verse) : handleToggleBookmark(v.verse))}
                    scaleTo={0.85}
                  >
                    <View style={{ width: 30, minHeight: 22, alignItems: 'center', paddingTop: 2 }}>
                      {isBookmarked && (
                        <Bookmark
                          size={12}
                          color={theme.colors.accent}
                          fill={theme.colors.accent}
                          strokeWidth={1.75}
                          style={{ marginBottom: 1 }}
                        />
                      )}
                      <Body
                        style={{
                          color: theme.colors.accent,
                          fontFamily: theme.fontFamily.sansSemiBold,
                          fontSize: theme.fontSize.sm,
                        }}
                      >
                        {v.verse}
                      </Body>
                    </View>
                  </PressableScale>
                  <Pressable
                    style={{ flex: 1, paddingTop: 2 }}
                    onPress={() => handleVersePress(v.verse)}
                    onLongPress={() => toggleVerseSelected(v.verse)}
                  >
                    <Body
                      style={{
                        fontFamily: theme.fontFamily.serifRegular,
                        fontSize: theme.fontSize.md,
                        lineHeight: theme.lineHeight.lg,
                      }}
                    >
                      {v.text}
                    </Body>
                  </Pressable>
                  {versesWithNotes.has(v.verse) && (
                    <PressableScale onPress={() => handleOpenNotes(v.verse)} scaleTo={0.85}>
                      <View style={{ paddingTop: 3, paddingLeft: theme.spacing.xs }}>
                        <NotebookPen size={14} color={theme.colors.primary} strokeWidth={1.75} />
                      </View>
                    </PressableScale>
                  )}
                  {getCrossReferences(book, chapter, v.verse).length > 0 && (
                    <PressableScale onPress={() => setCrossRefVerse(v.verse)} scaleTo={0.85}>
                      <View style={{ paddingTop: 3, paddingLeft: theme.spacing.xs }}>
                        <Link2 size={14} color={theme.colors.textFaint} strokeWidth={1.75} />
                      </View>
                    </PressableScale>
                  )}
                  {commentaryVerses.has(v.verse) && (
                    <PressableScale
                      onPress={() =>
                        router.push({
                          pathname: '/more/commentary/[book]/[chapter]',
                          // fromVerse tells the commentary screen's back button to return here specifically —
                          // it's reached by pushing into a different tab's own stack, so the default back
                          // button would otherwise pop into the More tab's history, not this screen.
                          params: { book, chapter: String(chapter), fromVerse: String(v.verse) },
                        })
                      }
                      scaleTo={0.85}
                    >
                      <View style={{ paddingTop: 3, paddingLeft: theme.spacing.xs }}>
                        <Library size={14} color={theme.colors.textFaint} strokeWidth={1.75} />
                      </View>
                    </PressableScale>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      </GestureDetector>

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
              {HIGHLIGHT_COLORS.map((color) => (
                <PressableScale key={color} onPress={() => handleHighlightSelection(color)} scaleTo={0.85}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: theme.radius.pill,
                      backgroundColor: swatchHex[color],
                    }}
                  />
                </PressableScale>
              ))}
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Body style={{ flex: 1, color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
              {selectedVerses.size} verse{selectedVerses.size > 1 ? 's' : ''} selected
            </Body>
            <PressableScale onPress={handleBookmarkSelection} style={{ padding: theme.spacing.xs }}>
              <Bookmark size={20} color={theme.colors.accent} strokeWidth={1.75} />
            </PressableScale>
            <PressableScale onPress={() => setShowColorRow((v) => !v)} style={{ padding: theme.spacing.xs }}>
              <Palette size={20} color={theme.colors.primary} strokeWidth={1.75} />
            </PressableScale>
            <PressableScale onPress={handleAddNoteFromSelection} style={{ padding: theme.spacing.xs }}>
              <NotebookPen size={20} color={theme.colors.primary} strokeWidth={1.75} />
            </PressableScale>
            <PressableScale onPress={clearSelection} style={{ padding: theme.spacing.xs }}>
              <X size={20} color={theme.colors.textMuted} strokeWidth={1.75} />
            </PressableScale>
          </View>
        </View>
      )}

      {readAloudOpen && (
        <ReadAloudBar
          state={readAloud.state}
          label={
            readAloud.activeKey
              ? `Reading verse ${readAloud.activeKey}`
              : `Read ${getLocalizedBookName(translation, book)} ${chapter} aloud`
          }
          onPlayPause={handleReadAloudPlayPause}
          onSkipBack={() => readAloud.skip(-1)}
          onSkipForward={() => readAloud.skip(1)}
          onOpenSettings={() => setVoiceSettingsOpen(true)}
          onClose={handleCloseReadAloud}
          onPlayInBackground={handlePlayInBackground}
          renderProgress={renderProgress}
        />
      )}

      <TranslationSheet
        visible={showVersionSheet}
        selected={translation}
        onSelect={setTranslation}
        onClose={() => setShowVersionSheet(false)}
      />
      <TranslationSheet
        visible={showCompareSheet}
        selected={compareTranslation ?? translation}
        onSelect={setCompareTranslation}
        onClose={() => setShowCompareSheet(false)}
      />
      <VoiceSettingsSheet
        visible={voiceSettingsOpen}
        rate={readAloud.rate}
        onSelectRate={readAloud.setRate}
        voice={readAloud.voice}
        onSelectVoice={readAloud.setVoice}
        onClose={() => setVoiceSettingsOpen(false)}
      />

      <Modal visible={crossRefVerse !== null} transparent animationType="fade" onRequestClose={() => setCrossRefVerse(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
          onPress={() => setCrossRefVerse(null)}
        >
          <Pressable
            style={{
              marginTop: 'auto',
              backgroundColor: theme.colors.background,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              padding: theme.spacing.lg,
              paddingBottom: theme.spacing.xl,
              gap: theme.spacing.sm,
            }}
          >
            <Label>Related Verses</Label>
            {crossRefVerse !== null &&
              getCrossReferences(book, chapter, crossRefVerse).map((ref) => (
                <PressableScale
                  key={`${ref.book}-${ref.chapter}-${ref.verse}`}
                  onPress={() => {
                    setCrossRefVerse(null);
                    router.push({
                      pathname: '/bible/[book]/[chapter]',
                      params: { book: ref.book, chapter: String(ref.chapter), verse: String(ref.verse) },
                    });
                  }}
                  scaleTo={0.98}
                >
                  <View
                    style={{
                      backgroundColor: theme.colors.surface,
                      borderRadius: theme.radius.md,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      padding: theme.spacing.sm + 2,
                    }}
                  >
                    <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }}>
                      {getLocalizedBookName(translation, ref.book)} {ref.chapter}:{ref.verse}
                    </Body>
                  </View>
                </PressableScale>
              ))}
            <Label style={{ marginTop: theme.spacing.xs, color: theme.colors.textFaint }}>
              Cross-references: openbible.info (CC BY)
            </Label>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
