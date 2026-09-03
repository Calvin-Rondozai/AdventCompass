import React, { useLayoutEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useNavigation } from 'expo-router';
import { ChevronRight, BookOpen, Search, Bookmark, Languages } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { useReadingPosition } from '@/hooks/useReadingPosition';
import { useBibleTranslation } from '@/hooks/useBibleTranslation';
import { getLocalizedBookName } from '@/database/bookNames';
import { PressableScale } from '@/components/ui/PressableScale';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { Body, Label } from '@/components/ui/Typography';
import { TranslationSheet } from '@/components/bible/TranslationSheet';
import { ReferencePicker } from '@/components/bible/ReferencePicker';

export default function BibleBooksScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { position, loaded } = useReadingPosition();
  const { translation, setTranslation } = useBibleTranslation();
  const [showVersionSheet, setShowVersionSheet] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <PressableScale onPress={() => setShowVersionSheet(true)} style={{ padding: theme.spacing.xs }}>
            <Languages size={20} color={theme.colors.text} strokeWidth={1.75} />
          </PressableScale>
          <PressableScale onPress={() => router.push('/bible/bookmarks')} style={{ padding: theme.spacing.xs }}>
            <Bookmark size={20} color={theme.colors.text} strokeWidth={1.75} />
          </PressableScale>
          <PressableScale onPress={() => router.push('/bible/search')} style={{ padding: theme.spacing.xs }}>
            <Search size={20} color={theme.colors.text} strokeWidth={1.75} />
          </PressableScale>
        </View>
      ),
    });
  }, [navigation, theme]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={[]}>
      {loaded && position && (
        <View style={{ paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.xs }}>
          <PressableScale
            onPress={() =>
              router.push({
                pathname: '/bible/[book]/[chapter]',
                params: { book: position.book, chapter: String(position.chapter) },
              })
            }
            scaleTo={0.98}
          >
            <AnimatedCard
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: theme.radius.xl,
                padding: theme.spacing.sm + 4,
              }}
            >
              <BookOpen size={28} color={theme.colors.primary} strokeWidth={1.75} />
              <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                <Label>Continue Reading</Label>
                <Body style={{ fontFamily: theme.fontFamily.sansSemiBold, marginTop: 2 }}>
                  {getLocalizedBookName(translation, position.book)} {position.chapter}
                </Body>
              </View>
              <ChevronRight size={18} color={theme.colors.textFaint} />
            </AnimatedCard>
          </PressableScale>
        </View>
      )}

      <ReferencePicker />

      <TranslationSheet
        visible={showVersionSheet}
        selected={translation}
        onSelect={setTranslation}
        onClose={() => setShowVersionSheet(false)}
      />
    </SafeAreaView>
  );
}
