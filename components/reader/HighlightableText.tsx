import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Text, TextStyle, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { findScriptureRefs } from '@/database/scriptureRefs';
import { HIGHLIGHT_HEX, HighlightColor } from '@/database/highlights';
import type { VerseRef } from '@/components/bible/VersePopup';

export type HighlightRange = { startWord: number; endWord: number; color: HighlightColor };
type WordRect = { x: number; y: number; width: number; height: number };

function tokenizeWords(text: string): { word: string; start: number; end: number }[] {
  const tokens: { word: string; start: number; end: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) tokens.push({ word: m[0], start: m.index, end: m.index + m[0].length });
  return tokens;
}

type Props = {
  text: string;
  blockIndex: number;
  highlights: HighlightRange[];
  // This block's finalized-but-unresolved selection, awaiting a color/remove choice —
  // owned by the parent screen (only one block can have a pending selection at a time,
  // shown via one shared bottom bar), not by this component.
  pendingRange: { start: number; end: number } | null;
  pendingColor: string;
  linkColor: string;
  textStyle?: TextStyle;
  onPressRef: (ref: VerseRef) => void;
  onSelectionEnd: (blockIndex: number, start: number, end: number) => void;
  // Optional per-word style override keyed by the word's own char range within `text` —
  // e.g. Children's Sermons uses this to keep "[stage directions]" italic/muted, a run
  // style this component has no built-in concept of otherwise.
  extraStyleForWord?: (start: number, end: number) => TextStyle | undefined;
};

// Renders one block's words as individually-measurable, individually-styleable `<Text>`
// siblings in a flex-wrap row (never nested inside one parent `<Text>`) — this is
// deliberate: React Native's `onLayout` is reliable for a real layout node like this, but
// notoriously unreliable for inline runs nested inside a single parent Text, which rules
// out the "one paragraph, one Text" approach for anything that needs per-word hit-testing
// during a drag. The trade-off is losing `textAlign: 'justify'` (flex-wrap rows can't do
// that) in exchange for gaining real press-and-drag text selection.
//
// Interaction: press and hold a word, then drag, to select a range — exactly like normal
// text selection — then lift to finalize. A quick tap (no hold) on a scripture reference
// still opens it immediately. `activateAfterLongPress` is what makes the drag gesture not
// fight the surrounding ScrollView: a plain scroll swipe never holds still long enough to
// arm it.
export function HighlightableText({
  text,
  blockIndex,
  highlights,
  pendingRange,
  pendingColor,
  linkColor,
  textStyle,
  onPressRef,
  onSelectionEnd,
  extraStyleForWord,
}: Props) {
  const theme = useTheme();
  const swatchHex = HIGHLIGHT_HEX[theme.scheme];
  const words = useMemo(() => tokenizeWords(text), [text]);
  const refs = useMemo(() => findScriptureRefs(text), [text]);

  // A reference's words snap together as one atomic unit for drag/tap purposes (so
  // "Rom. 5:8" always selects or opens as a whole), without changing the underlying raw
  // word-index numbering used for persistence.
  const refBoundsForWord = useMemo(() => {
    const map = new Map<number, [number, number]>();
    refs.forEach((ref) => {
      let first = -1;
      let last = -1;
      words.forEach((w, idx) => {
        if (w.start >= ref.start && w.start < ref.end) {
          if (first === -1) first = idx;
          last = idx;
        }
      });
      if (first !== -1) {
        for (let idx = first; idx <= last; idx++) map.set(idx, [first, last]);
      }
    });
    return map;
  }, [refs, words]);

  const refForWord = useMemo(() => {
    const map = new Map<number, VerseRef>();
    refs.forEach((ref) => {
      words.forEach((w, idx) => {
        if (w.start >= ref.start && w.start < ref.end) {
          map.set(idx, { book: ref.book, chapter: ref.chapter, verse: ref.verse, verseEnd: ref.verseEnd });
        }
      });
    });
    return map;
  }, [refs, words]);

  const layoutsRef = useRef<Map<number, WordRect>>(new Map());
  // Mirrors the liveAnchor/liveCurrent state below in refs too — handleEnd needs their
  // latest values without depending on them, since a callback that changes identity on
  // every drag update would reassign GestureDetector's gesture object mid-drag and risk
  // cancelling the gesture that's actively tracking.
  const liveAnchorRef = useRef<number | null>(null);
  const liveCurrentRef = useRef<number | null>(null);
  const [liveAnchor, setLiveAnchor] = useState<number | null>(null);
  const [liveCurrent, setLiveCurrent] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  // Nearest-word hit test rather than exact rect containment — a finger landing in the
  // small gap between two words (or two wrapped lines) should still resolve to whichever
  // word is closest, not fall through to "nothing hit."
  const findNearestWord = useCallback((x: number, y: number): number | null => {
    let best: number | null = null;
    let bestDist = Infinity;
    layoutsRef.current.forEach((rect, idx) => {
      const withinRow = y >= rect.y - 4 && y <= rect.y + rect.height + 4;
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      const dx = x - cx;
      const dy = withinRow ? 0 : y - cy;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = idx;
      }
    });
    return best;
  }, []);

  const handleBegin = useCallback(
    (x: number, y: number) => {
      const idx = findNearestWord(x, y);
      if (idx == null) return;
      liveAnchorRef.current = idx;
      liveCurrentRef.current = idx;
      setLiveAnchor(idx);
      setLiveCurrent(idx);
      setDragging(true);
    },
    [findNearestWord]
  );

  const handleUpdate = useCallback(
    (x: number, y: number) => {
      const idx = findNearestWord(x, y);
      if (idx == null) return;
      liveCurrentRef.current = idx;
      setLiveCurrent(idx);
    },
    [findNearestWord]
  );

  const handleEnd = useCallback(() => {
    setDragging(false);
    const anchor = liveAnchorRef.current;
    const current = liveCurrentRef.current;
    if (anchor != null && current != null) {
      let start = Math.min(anchor, current);
      let end = Math.max(anchor, current);
      start = refBoundsForWord.get(start)?.[0] ?? start;
      end = refBoundsForWord.get(end)?.[1] ?? end;
      onSelectionEnd(blockIndex, start, end);
    }
    liveAnchorRef.current = null;
    liveCurrentRef.current = null;
    setLiveAnchor(null);
    setLiveCurrent(null);
  }, [refBoundsForWord, blockIndex, onSelectionEnd]);

  const handleTapRef = useCallback(
    (x: number, y: number) => {
      const idx = findNearestWord(x, y);
      if (idx == null) return;
      const ref = refForWord.get(idx);
      if (ref) onPressRef(ref);
    },
    [findNearestWord, refForWord, onPressRef]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(350)
        .onStart((e) => runOnJS(handleBegin)(e.x, e.y))
        .onUpdate((e) => runOnJS(handleUpdate)(e.x, e.y))
        .onEnd(() => runOnJS(handleEnd)()),
    [handleBegin, handleUpdate, handleEnd]
  );

  const tap = useMemo(() => Gesture.Tap().onEnd((e) => runOnJS(handleTapRef)(e.x, e.y)), [handleTapRef]);

  const composedGesture = useMemo(() => Gesture.Race(pan, tap), [pan, tap]);

  let liveStart: number | null = null;
  let liveEnd: number | null = null;
  if (dragging && liveAnchor != null && liveCurrent != null) {
    liveStart = Math.min(liveAnchor, liveCurrent);
    liveEnd = Math.max(liveAnchor, liveCurrent);
    liveStart = refBoundsForWord.get(liveStart)?.[0] ?? liveStart;
    liveEnd = refBoundsForWord.get(liveEnd)?.[1] ?? liveEnd;
  }

  const persistedColorForWord = (idx: number): string | undefined => {
    let color: string | undefined;
    for (const h of highlights) {
      // -1/-1 marks a legacy whole-block highlight from before word ranges existed
      // (see Sabbath School's sabbath_highlights table) — it applies to every word.
      if (h.startWord === -1 || (idx >= h.startWord && idx <= h.endWord)) color = swatchHex[h.color];
    }
    return color;
  };

  return (
    <GestureDetector gesture={composedGesture}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {words.map((w, idx) => {
          const isLive = liveStart != null && liveEnd != null && idx >= liveStart && idx <= liveEnd;
          const isPending = !isLive && !!pendingRange && idx >= pendingRange.start && idx <= pendingRange.end;
          const ref = refForWord.get(idx);
          const backgroundColor = isLive || isPending ? pendingColor : persistedColorForWord(idx);
          const extraStyle = extraStyleForWord?.(w.start, w.end);
          return (
            <Text
              key={idx}
              onLayout={(e: LayoutChangeEvent) => {
                const { x, y, width, height } = e.nativeEvent.layout;
                layoutsRef.current.set(idx, { x, y, width, height });
              }}
              style={[
                textStyle,
                extraStyle,
                {
                  backgroundColor,
                  color: ref ? linkColor : extraStyle?.color ?? textStyle?.color,
                  textDecorationLine: ref ? 'underline' : 'none',
                },
              ]}
            >
              {w.word}{' '}
            </Text>
          );
        })}
      </View>
    </GestureDetector>
  );
}
