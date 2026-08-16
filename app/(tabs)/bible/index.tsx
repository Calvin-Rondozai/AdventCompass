import React, { useLayoutEffect, useMemo, useState } from 'react';
import { SectionList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useNavigation } from 'expo-router';
import { ChevronRight, BookOpen, Search, Bookmark, Languages } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { useReadingPosition } from '@/hooks/useReadingPosition';
import { useBibleTranslation } from '@/hooks/useBibleTranslation';
import { BIBLE_BOOKS } from '@/database/bibleBooks';
import { getLocalizedBookName } from '@/database/bookNames';
import { PressableScale } from '@/components/ui/PressableScale';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { Body, Heading, Label } from '@/components/ui/Typography';
import { TranslationSheet } from '@/components/bible/TranslationSheet';

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

  const sections = useMemo(
    () => [
      { title: 'Old Testament', data: BIBLE_BOOKS.filter((b) => b.testament === 'old') },
      { title: 'New Testament', data: BIBLE_BOOKS.filter((b) => b.testament === 'new') },
    ],
    []
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={[]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.name}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        ListHeaderComponent={
          <>
            {loaded && position ? (
            <PressableScale
              onPress={() =>
                router.push({
                  pathname: '/bible/[book]/[chapter]',
                  params: { book: position.book, chapter: String(position.chapter) },
                })
              }
              scaleTo={0.98}
            >
              <AnimatedCard style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.primarySoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BookOpen size={20} color={theme.colors.primary} strokeWidth={1.75} />
                </View>
                <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                  <Label>Continue Reading</Label>
                  <Body style={{ fontFamily: theme.fontFamily.sansSemiBold, marginTop: 2 }}>
                    {getLocalizedBookName(translation, position.book)} {position.chapter}
                  </Body>
                </View>
                <ChevronRight size={18} color={theme.colors.textFaint} />
              </AnimatedCard>
            </PressableScale>
            ) : null}
          </>
        }
        renderSectionHeader={({ section }) => (
          <Label style={{ marginTop: theme.spacing.md, marginBottom: theme.spacing.sm }}>{section.title}</Label>
        )}
        renderItem={({ item }) => (
          <PressableScale
            onPress={() => router.push({ pathname: '/bible/[book]', params: { book: item.name } })}
            scaleTo={0.99}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: theme.spacing.sm + 2,
                paddingHorizontal: theme.spacing.md,
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.lg,
                marginBottom: theme.spacing.xs + 2,
                ...theme.shadow.subtle,
              }}
            >
              <Body style={{ flex: 1 }}>{getLocalizedBookName(translation, item.name)}</Body>
              <Body style={{ color: theme.colors.textFaint, fontSize: theme.fontSize.sm, marginRight: theme.spacing.xs }}>
                {item.chapters} ch
              </Body>
              <ChevronRight size={16} color={theme.colors.textFaint} />
            </View>
          </PressableScale>
        )}
        stickySectionHeadersEnabled={false}
      />
      <TranslationSheet
        visible={showVersionSheet}
        selected={translation}
        onSelect={setTranslation}
        onClose={() => setShowVersionSheet(false)}
      />
    </SafeAreaView>
  );
}
