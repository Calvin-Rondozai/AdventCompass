import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { BackHandler, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';
import { getCommentaryChapter } from '@/database/sdaCommentary';
import { findScriptureRefs } from '@/database/scriptureRefs';
import { VersePopup, VerseRef } from '@/components/bible/VersePopup';
import { ArrowLeft } from '@/components/ui/Icon';
import { PageLoader } from '@/components/ui/PageLoader';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Heading, Label } from '@/components/ui/Typography';

// Commentary text is full of scripture cross-references ("Psalm 33:6, 9", "Ephesians
// 3:15") — make each one tappable, popping up that verse right here instead of
// navigating away and leaving the commentary.
function renderEntryText(text: string, linkColor: string, onPressRef: (ref: VerseRef) => void) {
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

export default function CommentaryEntriesScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { book: rawBook, chapter: rawChapter, fromVerse } = useLocalSearchParams<{
    book: string;
    chapter: string;
    fromVerse?: string;
  }>();
  const book = decodeURIComponent(rawBook ?? '');
  const chapterNumber = Number(rawChapter);
  const chapter = useMemo(() => getCommentaryChapter(book, chapterNumber), [book, chapterNumber]);
  const [popupRef, setPopupRef] = useState<VerseRef>(null);

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
    });
  }, [navigation, book, chapterNumber, fromVerse, theme, goBackToVerse]);

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
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Heading style={{ marginBottom: theme.spacing.md }}>
          {book} {chapter.number}
        </Heading>
        {chapter.entries.map((entry, i) => (
          <View key={i} style={{ marginBottom: theme.spacing.md }}>
            <Label style={{ marginBottom: 2 }}>
              {entry.verseStart === entry.verseEnd ? `Verse ${entry.verseStart}` : `Verses ${entry.verseStart}-${entry.verseEnd}`}
            </Label>
            <Body
              selectable
              style={{
                fontFamily: theme.fontFamily.serifRegular,
                fontSize: theme.fontSize.md,
                lineHeight: theme.lineHeight.lg,
                textAlign: 'justify',
              }}
            >
              {renderEntryText(entry.content, theme.colors.primary, setPopupRef)}
            </Body>
          </View>
        ))}
      </ScrollView>
      <VersePopup reference={popupRef} onClose={() => setPopupRef(null)} />
    </SafeAreaView>
  );
}
