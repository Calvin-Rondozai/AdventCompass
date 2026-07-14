import React, { useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';
import { getCommentaryChapter } from '@/database/sdaCommentary';
import { findScriptureRefs } from '@/database/scriptureRefs';
import { VersePopup, VerseRef } from '@/components/bible/VersePopup';
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
  const { book: rawBook, chapter: rawChapter } = useLocalSearchParams<{ book: string; chapter: string }>();
  const book = decodeURIComponent(rawBook ?? '');
  const chapterNumber = Number(rawChapter);
  const chapter = useMemo(() => getCommentaryChapter(book, chapterNumber), [book, chapterNumber]);
  const [popupRef, setPopupRef] = useState<VerseRef>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: `${book} ${chapterNumber}` });
  }, [navigation, book, chapterNumber]);

  if (!chapter) return null;

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
