import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Gift } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getChildrensSermon } from '@/database/childrensSermons';
import { findScriptureRefs } from '@/database/scriptureRefs';
import { VersePopup, VerseRef } from '@/components/bible/VersePopup';
import { HighlightColor } from '@/database/highlights';
import { addWordHighlight, getWordHighlights, removeWordHighlight, WordHighlight } from '@/database/wordHighlights';
import { PageLoader } from '@/components/ui/PageLoader';
import { HighlightableText } from '@/components/reader/HighlightableText';
import { HighlightActionBar } from '@/components/reader/HighlightActionBar';
import { Body, Heading, Label } from '@/components/ui/Typography';

// Matches "[stage direction]" bracket spans within a paragraph's char range, so they can
// keep their distinct italic/muted styling even though the paragraph as a whole now
// renders through HighlightableText's word-by-word layout.
function bracketRanges(text: string): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  const re = /\[[^\]]+\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) ranges.push({ start: m.index, end: m.index + m[0].length });
  return ranges;
}

export default function ChildrensSermonScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sermon = getChildrensSermon(id ?? '');
  const [popupRef, setPopupRef] = useState<VerseRef>(null);

  const contentKey = id ?? '';
  const [highlights, setHighlights] = useState<Map<number, WordHighlight[]>>(new Map());
  const [pending, setPending] = useState<{ block: number; start: number; end: number } | null>(null);

  useEffect(() => {
    if (!contentKey) return;
    setPending(null);
    getWordHighlights(db, 'sermon', contentKey).then(setHighlights);
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
      const id2 = await addWordHighlight(db, 'sermon', contentKey, pending.block, pending.start, pending.end, color);
      setHighlights((prev) => {
        const next = new Map(prev);
        next.set(pending.block, [
          ...(next.get(pending.block) ?? []),
          { id: id2, blockIndex: pending.block, startWord: pending.start, endWord: pending.end, color },
        ]);
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

  useLayoutEffect(() => {
    navigation.setOptions({ title: sermon?.title ?? 'Children’s Sermon' });
  }, [navigation, sermon]);

  if (!sermon) return <PageLoader />;

  const paragraphs = sermon.body.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const scriptureMatch = findScriptureRefs(sermon.scriptureRef)[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Heading style={{ marginBottom: theme.spacing.sm }}>{sermon.title}</Heading>

        {!!sermon.theme && (
          <Body style={{ color: theme.colors.textMuted, fontStyle: 'italic', marginBottom: theme.spacing.md }}>
            {sermon.theme}
          </Body>
        )}

        <View
          style={{
            backgroundColor: theme.colors.surfaceMuted,
            borderRadius: theme.radius.md,
            padding: theme.spacing.sm + 2,
            marginBottom: theme.spacing.lg,
            gap: theme.spacing.xs,
          }}
        >
          {!!sermon.object && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Gift size={16} color={theme.colors.primary} strokeWidth={1.75} style={{ marginTop: 2 }} />
              <Body style={{ flex: 1, marginLeft: theme.spacing.xs, fontSize: theme.fontSize.sm }}>{sermon.object}</Body>
            </View>
          )}
          <Label
            style={{ color: theme.colors.primary, textDecorationLine: scriptureMatch ? 'underline' : 'none' }}
            onPress={
              scriptureMatch
                ? () =>
                    setPopupRef({
                      book: scriptureMatch.book,
                      chapter: scriptureMatch.chapter,
                      verse: scriptureMatch.verse,
                      verseEnd: scriptureMatch.verseEnd,
                    })
                : undefined
            }
          >
            {sermon.scriptureRef}
          </Label>
        </View>

        {paragraphs.map((para, i) => {
          const brackets = bracketRanges(para);
          return (
            <View key={i} style={{ marginBottom: theme.spacing.sm }}>
              <HighlightableText
                text={para}
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
                extraStyleForWord={(start, end) =>
                  brackets.some((b) => start >= b.start && end <= b.end)
                    ? { fontStyle: 'italic', color: theme.colors.textMuted }
                    : undefined
                }
                onPressRef={setPopupRef}
                onSelectionEnd={handleSelectionEnd}
              />
            </View>
          );
        })}
      </ScrollView>
      <VersePopup reference={popupRef} onClose={() => setPopupRef(null)} />

      {pending && (
        <HighlightActionBar
          wordCount={pending.end - pending.start + 1}
          hasExistingHighlight={overlapping.length > 0}
          onPickColor={applyColor}
          onRemove={applyRemove}
          onCancel={() => setPending(null)}
        />
      )}
    </SafeAreaView>
  );
}
