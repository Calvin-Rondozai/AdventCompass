import React, { useLayoutEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { ChevronLeft, ChevronRight } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getFundamentalBelief, getFundamentalBeliefs } from '@/database/fundamentalBeliefs';
import { findScriptureRefs } from '@/database/scriptureRefs';
import { VersePopup, VerseRef } from '@/components/bible/VersePopup';
import { PageLoader } from '@/components/ui/PageLoader';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Heading, Label } from '@/components/ui/Typography';

// Belief text is full of scripture references ("John 3:16") — make each one tappable
// so it pops up right here, same pattern as the commentary and Sabbath School readers.
function renderBeliefText(text: string, linkColor: string, onPressRef: (ref: VerseRef) => void) {
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

export default function BeliefDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { number } = useLocalSearchParams<{ number: string }>();
  const n = Number(number);
  const belief = getFundamentalBelief(n);
  const total = getFundamentalBeliefs().length;
  const [popupRef, setPopupRef] = useState<VerseRef>(null);

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
          <Body
            key={i}
            style={{
              fontFamily: theme.fontFamily.serifRegular,
              fontSize: theme.fontSize.md,
              lineHeight: theme.lineHeight.lg,
              marginBottom: theme.spacing.sm,
            }}
          >
            {renderBeliefText(para, theme.colors.primary, setPopupRef)}
          </Body>
        ))}
      </ScrollView>
      <VersePopup reference={popupRef} onClose={() => setPopupRef(null)} />

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
    </SafeAreaView>
  );
}
