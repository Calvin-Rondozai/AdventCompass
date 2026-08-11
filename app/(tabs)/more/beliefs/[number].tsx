import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ChevronLeft, ChevronRight } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getFundamentalBelief, getFundamentalBeliefs } from '@/database/fundamentalBeliefs';
import { VersePopup, VerseRef } from '@/components/bible/VersePopup';
import { HighlightColor } from '@/database/highlights';
import { addWordHighlight, getWordHighlights, removeWordHighlight, WordHighlight } from '@/database/wordHighlights';
import { PageLoader } from '@/components/ui/PageLoader';
import { PressableScale } from '@/components/ui/PressableScale';
import { HighlightableText } from '@/components/reader/HighlightableText';
import { HighlightActionBar } from '@/components/reader/HighlightActionBar';
import { Body, Heading, Label } from '@/components/ui/Typography';

export default function BeliefDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const db = useSQLiteContext();
  const { number } = useLocalSearchParams<{ number: string }>();
  const n = Number(number);
  const belief = getFundamentalBelief(n);
  const total = getFundamentalBeliefs().length;
  const [popupRef, setPopupRef] = useState<VerseRef>(null);

  const contentKey = String(n);
  const [highlights, setHighlights] = useState<Map<number, WordHighlight[]>>(new Map());
  const [pending, setPending] = useState<{ block: number; start: number; end: number } | null>(null);

  useEffect(() => {
    setPending(null);
    getWordHighlights(db, 'beliefs', contentKey).then(setHighlights);
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
      const id = await addWordHighlight(db, 'beliefs', contentKey, pending.block, pending.start, pending.end, color);
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

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Fundamental Beliefs' });
  }, [navigation]);

  if (!belief) return <PageLoader />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Label style={{ marginBottom: 4 }}>Belief {belief.number} of {total}</Label>
        <Heading style={{ marginBottom: theme.spacing.md }}>{belief.title}</Heading>
        {belief.content.split('\n\n').map((para, i) => (
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
              onPressRef={setPopupRef}
              onSelectionEnd={handleSelectionEnd}
            />
          </View>
        ))}
      </ScrollView>
      <VersePopup reference={popupRef} onClose={() => setPopupRef(null)} />

      {pending ? (
        <HighlightActionBar
          wordCount={pending.end - pending.start + 1}
          hasExistingHighlight={overlapping.length > 0}
          onPickColor={applyColor}
          onRemove={applyRemove}
          onCancel={() => setPending(null)}
        />
      ) : (
        <View
          style={{
            flexDirection: 'row',
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          }}
        >
          <PressableScale
            disabled={n <= 1}
            onPress={() => n > 1 && router.replace({ pathname: '/more/beliefs/[number]', params: { number: String(n - 1) } })}
            style={{ flex: 1, opacity: n > 1 ? 1 : 0.35 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: theme.spacing.md }}>
              <ChevronLeft size={16} color={theme.colors.text} />
              <Body style={{ marginLeft: 4, fontSize: theme.fontSize.sm }}>Previous</Body>
            </View>
          </PressableScale>
          <View style={{ width: 1, backgroundColor: theme.colors.border }} />
          <PressableScale
            disabled={n >= total}
            onPress={() => n < total && router.replace({ pathname: '/more/beliefs/[number]', params: { number: String(n + 1) } })}
            style={{ flex: 1, opacity: n < total ? 1 : 0.35 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: theme.spacing.md }}>
              <Body style={{ marginRight: 4, fontSize: theme.fontSize.sm }}>Next</Body>
              <ChevronRight size={16} color={theme.colors.text} />
            </View>
          </PressableScale>
        </View>
      )}
    </SafeAreaView>
  );
}
