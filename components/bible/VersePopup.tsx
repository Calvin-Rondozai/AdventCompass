import React, { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
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
//
// Rendered as a plain absolutely-positioned overlay rather than RN's <Modal>: Modal opens a
// separate native Android Window, and showing/dismissing that window forces the host
// Activity's window (which owns the bottom tab bar) to redraw — the visible cause of the tab
// bar "flicking" when this closes. A same-window overlay avoids that redraw entirely.
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

  useEffect(() => {
    if (!reference) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [reference, onClose]);

  if (!reference) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 1000 }]}
    >
      {/* Backdrop and card are SIBLINGS, not nested — this is the actual fix for the
          scrolling glitch. Nesting the card inside the backdrop Pressable meant something on
          the card (a responder prop, an inner Pressable, or selectable text) always had to
          intercept the touch to stop it bubbling up to the backdrop's onPress — and every
          one of those interception mechanisms competes with the ScrollView's own native
          scroll-gesture recognizer for the same drag, especially on Android. As siblings,
          native hit-testing finds whichever one is topmost at the touch point directly; the
          card's own Views never need to claim or block anything, so the ScrollView inside it
          gets an untouched, uncontested drag gesture. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
      </Pressable>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} pointerEvents="box-none">
        <View
          style={{
            width: '86%',
            maxHeight: '80%',
            backgroundColor: theme.colors.background,
            borderRadius: theme.radius.lg,
            padding: theme.spacing.lg,
            gap: theme.spacing.sm,
          }}
        >
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
            // flexShrink (not a fixed maxHeight) so this only shrinks as far as it actually
            // needs to within the card's own maxHeight: '80%' cap — a long verse range now
            // reliably scrolls within whatever room is left after the header/button rows,
            // instead of being bound to one hardcoded number that could clip content the
            // fixed height didn't account for. minHeight: 0 is required alongside flexShrink —
            // a flex item's default min-height is its own content size, which silently
            // overrides flexShrink and was why this still rendered at full (unscrollable,
            // overflowing) height without it.
            <ScrollView style={{ flexShrink: 1, minHeight: 0 }} showsVerticalScrollIndicator>
              {/* selectable turns on the platform's native text selection — long-press to
                  drag selection handles and get the native copy/share menu, the same way
                  selecting text works in a browser, instead of the custom word-tap
                  highlighting scheme used elsewhere in the app (Sabbath School, EGW). */}
              <Body
                selectable
                style={{ fontFamily: theme.fontFamily.serifRegular, fontSize: theme.fontSize.md, lineHeight: theme.lineHeight.lg }}
              >
                {verses.map((v) => (
                  <Body key={v.id}>
                    <Body style={{ fontFamily: theme.fontFamily.sansSemiBold, color: theme.colors.primary }}>{v.verse}. </Body>
                    {v.text}{' '}
                  </Body>
                ))}
              </Body>
            </ScrollView>
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
        </View>
      </View>
      <TranslationSheet
        visible={showVersionSheet}
        selected={translation}
        onSelect={setTranslation}
        onClose={() => setShowVersionSheet(false)}
      />
    </Animated.View>
  );
}
