import React, { useLayoutEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Gift } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getChildrensSermon } from '@/database/childrensSermons';
import { findScriptureRefs } from '@/database/scriptureRefs';
import { VersePopup, VerseRef } from '@/components/bible/VersePopup';
import { PageLoader } from '@/components/ui/PageLoader';
import { Body, Heading, Label } from '@/components/ui/Typography';

// Stage directions like "[Pass out and read resolutions]" are kept inline in the source —
// render them distinctly (italic, muted) so they read as directions, not narration.
function renderBody(text: string, mutedColor: string) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return parts.map((part, i) => {
    if (part.startsWith('[') && part.endsWith(']')) {
      return (
        <Body key={i} style={{ fontStyle: 'italic', color: mutedColor }}>
          {part}
        </Body>
      );
    }
    return part;
  });
}

export default function ChildrensSermonScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sermon = getChildrensSermon(id ?? '');
  const [popupRef, setPopupRef] = useState<VerseRef>(null);

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

        {paragraphs.map((para, i) => (
          <Body
            key={i}
            style={{
              fontFamily: theme.fontFamily.serifRegular,
              fontSize: theme.fontSize.md,
              lineHeight: theme.lineHeight.lg,
              marginBottom: theme.spacing.sm,
            }}
          >
            {renderBody(para, theme.colors.textMuted)}
          </Body>
        ))}
      </ScrollView>
      <VersePopup reference={popupRef} onClose={() => setPopupRef(null)} />
    </SafeAreaView>
  );
}
