import React, { useLayoutEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';
import { ReferencePicker } from '@/components/bible/ReferencePicker';

// Deep-linked from the chapter reading header, the book list, and search's "go to
// book" — always lands on CHAPTER (the most common entry point), pre-selecting the book
// from the URL, and pre-highlighting the chapter too when one was passed in. The Bible
// tab's own home screen (app/(tabs)/bible/index.tsx) renders the same <ReferencePicker />
// with no initial book/chapter, above its own Continue Reading card.
export default function ReferencePickerScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { book: rawBook, chapter: rawChapter } = useLocalSearchParams<{ book: string; chapter?: string }>();

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'References' });
  }, [navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={[]}>
      <ReferencePicker
        initialBook={decodeURIComponent(rawBook ?? '')}
        initialChapter={rawChapter ? Number(rawChapter) : undefined}
      />
    </SafeAreaView>
  );
}
