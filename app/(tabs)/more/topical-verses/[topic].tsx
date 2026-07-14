import React, { useEffect, useLayoutEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { useTheme } from '@/theme/ThemeProvider';
import { TOPICS, TopicalVerseRef } from '@/database/topicalVerses';
import { getVerseRange } from '@/database/bible';
import { getLocalizedBookName } from '@/database/bookNames';
import { useBibleTranslation } from '@/hooks/useBibleTranslation';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Label } from '@/components/ui/Typography';

type Resolved = TopicalVerseRef & { text: string };

export default function TopicalVerseListScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const { topic: topicKey } = useLocalSearchParams<{ topic: string }>();
  const { translation } = useBibleTranslation();
  const topic = TOPICS.find((t) => t.key === topicKey);
  const [resolved, setResolved] = useState<Resolved[]>([]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: topic?.label ?? 'Topical Verses' });
  }, [navigation, topic]);

  useEffect(() => {
    if (!topic) return;
    let cancelled = false;
    Promise.all(
      topic.verses.map(async (ref) => {
        const verses = await getVerseRange(db, translation, ref.book, ref.chapter, ref.verseStart, ref.verseEnd);
        return { ...ref, text: verses.map((v) => v.text).join(' ') };
      })
    ).then((results) => {
      if (!cancelled) setResolved(results);
    });
    return () => {
      cancelled = true;
    };
  }, [db, translation, topic]);

  if (!topic) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <FlatList
        data={resolved}
        keyExtractor={(item, i) => `${item.book}-${item.chapter}-${item.verseStart}-${i}`}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        renderItem={({ item }) => (
          <PressableScale
            onPress={() =>
              router.push({
                pathname: '/bible/[book]/[chapter]',
                params: { book: item.book, chapter: String(item.chapter), verse: String(item.verseStart) },
              })
            }
            scaleTo={0.99}
          >
            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.border,
                padding: theme.spacing.md,
                marginBottom: theme.spacing.sm,
              }}
            >
              <Label style={{ color: theme.colors.primary, marginBottom: 4 }}>
                {getLocalizedBookName(translation, item.book)} {item.chapter}:{item.verseStart}
                {item.verseEnd ? `-${item.verseEnd}` : ''}
              </Label>
              {item.text ? (
                <Body style={{ fontFamily: theme.fontFamily.serifRegular, fontSize: theme.fontSize.md, lineHeight: theme.lineHeight.lg }}>
                  {item.text}
                </Body>
              ) : (
                <Body style={{ color: theme.colors.textMuted }}>Loading…</Body>
              )}
            </View>
          </PressableScale>
        )}
      />
    </SafeAreaView>
  );
}
