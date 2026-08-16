import React, { useLayoutEffect, useMemo } from 'react';
import { FlatList, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';
import { BIBLE_BOOKS } from '@/database/bibleBooks';
import { getLocalizedBookName } from '@/database/bookNames';
import { useBibleTranslation } from '@/hooks/useBibleTranslation';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body } from '@/components/ui/Typography';

export default function BookChaptersScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { translation } = useBibleTranslation();
  const { book: rawBook } = useLocalSearchParams<{ book: string }>();
  const book = decodeURIComponent(rawBook ?? '');

  const bookInfo = useMemo(() => BIBLE_BOOKS.find((b) => b.name === book), [book]);
  const chapters = useMemo(
    () => Array.from({ length: bookInfo?.chapters ?? 0 }, (_, i) => i + 1),
    [bookInfo]
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: getLocalizedBookName(translation, book) });
  }, [navigation, book, translation]);

  const columns = 5;
  const { width: windowWidth } = useWindowDimensions();
  const cellSize =
    (windowWidth - theme.spacing.lg * 2 - theme.spacing.sm * (columns - 1)) / columns;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={[]}>
      <FlatList
        data={chapters}
        keyExtractor={(n) => String(n)}
        numColumns={columns}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        columnWrapperStyle={{ gap: theme.spacing.sm }}
        renderItem={({ item }) => (
          <PressableScale
            onPress={() =>
              router.push({ pathname: '/bible/[book]/[chapter]', params: { book, chapter: String(item) } })
            }
            scaleTo={0.94}
            style={{ width: cellSize, marginBottom: theme.spacing.sm }}
          >
            <View
              style={{
                width: cellSize,
                height: cellSize,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.lg,
                ...theme.shadow.subtle,
              }}
            >
              <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }}>{item}</Body>
            </View>
          </PressableScale>
        )}
      />
    </SafeAreaView>
  );
}
