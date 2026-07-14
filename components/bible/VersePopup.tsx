import React, { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ArrowRight, ChevronDown } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getVerseRange, Verse } from '@/database/bible';
import { getLocalizedBookName } from '@/database/bookNames';
import { useBibleTranslation } from '@/hooks/useBibleTranslation';
import { PressableScale } from '@/components/ui/PressableScale';
import { TranslationSheet } from '@/components/bible/TranslationSheet';
import { Body, Heading, Label } from '@/components/ui/Typography';

export type VerseRef = { book: string; chapter: number; verse: number; verseEnd?: number } | null;

// A quick "peek" at a referenced verse without leaving whatever you're reading (a
// Sabbath School lesson, a commentary note) — tapping a scripture reference opens this
// instead of navigating away. "Read in Bible" is still there for anyone who wants the
// full chapter.
export function VersePopup({ reference, onClose }: { reference: VerseRef; onClose: () => void }) {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { translation, setTranslation } = useBibleTranslation();
  const [verses, setVerses] = useState<Verse[]>([]);
  const [showVersionSheet, setShowVersionSheet] = useState(false);

  useEffect(() => {
    if (!reference) {
      setVerses([]);
      return;
    }
    getVerseRange(db, translation, reference.book, reference.chapter, reference.verse, reference.verseEnd).then(setVerses);
  }, [db, translation, reference]);

  return (
    <Modal visible={!!reference} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }} onPress={onClose}>
        <Pressable
          style={{
            width: '86%',
            backgroundColor: theme.colors.background,
            borderRadius: theme.radius.lg,
            padding: theme.spacing.lg,
            gap: theme.spacing.sm,
          }}
        >
          {reference && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Label style={{ color: theme.colors.primary }}>
                  {getLocalizedBookName(translation, reference.book)} {reference.chapter}:{reference.verse}
                  {reference.verseEnd ? `-${reference.verseEnd}` : ''}
                </Label>
                <PressableScale onPress={() => setShowVersionSheet(true)} scaleTo={0.95}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Label style={{ color: theme.colors.textMuted }}>{translation}</Label>
                    <ChevronDown size={12} color={theme.colors.textMuted} />
                  </View>
                </PressableScale>
              </View>
              {verses.length > 0 ? (
                <Body style={{ fontFamily: theme.fontFamily.serifRegular, fontSize: theme.fontSize.md, lineHeight: theme.lineHeight.lg }}>
                  {verses.map((v) => v.text).join(' ')}
                </Body>
              ) : (
                <Body style={{ color: theme.colors.textMuted }}>Loading…</Body>
              )}
              <PressableScale
                onPress={() => {
                  onClose();
                  router.push({
                    pathname: '/bible/[book]/[chapter]',
                    params: { book: reference.book, chapter: String(reference.chapter), verse: String(reference.verse) },
                  });
                }}
                scaleTo={0.98}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: theme.spacing.xs }}>
                  <Body style={{ color: theme.colors.primary, fontFamily: theme.fontFamily.sansSemiBold, marginRight: 4 }}>
                    Read in Bible
                  </Body>
                  <ArrowRight size={14} color={theme.colors.primary} />
                </View>
              </PressableScale>
            </>
          )}
        </Pressable>
      </Pressable>
      <TranslationSheet
        visible={showVersionSheet}
        selected={translation}
        onSelect={setTranslation}
        onClose={() => setShowVersionSheet(false)}
      />
    </Modal>
  );
}
