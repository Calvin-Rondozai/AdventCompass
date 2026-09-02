import React, { useLayoutEffect, useMemo } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { ChevronRight } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getCommentaryChapters } from '@/database/sdaCommentary';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Label } from '@/components/ui/Typography';

export default function CommentaryChapterListScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { book: rawBook } = useLocalSearchParams<{ book: string }>();
  const book = decodeURIComponent(rawBook ?? '');
  const chapters = useMemo(() => getCommentaryChapters(book), [book]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: book });
  }, [navigation, book]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <FlatList
        data={chapters}
        keyExtractor={(item) => String(item.number)}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        ListHeaderComponent={<Label style={{ marginBottom: theme.spacing.sm }}>Chapters with commentary</Label>}
        renderItem={({ item, index }) => (
          <PressableScale
            onPress={() =>
              router.push({ pathname: '/more/commentary/[book]/[chapter]', params: { book, chapter: String(item.number) } })
            }
            scaleTo={0.99}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: theme.spacing.sm + 2,
                borderBottomWidth: index === chapters.length - 1 ? 0 : 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <Body style={{ flex: 1 }}>Chapter {item.number}</Body>
              <Label style={{ marginRight: theme.spacing.sm }}>{item.entries.length} notes</Label>
              <ChevronRight size={16} color={theme.colors.textFaint} />
            </View>
          </PressableScale>
        )}
      />
    </SafeAreaView>
  );
}
