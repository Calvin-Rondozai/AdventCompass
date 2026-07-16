import React, { useMemo } from 'react';
import { SectionList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronRight } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { BIBLE_BOOKS } from '@/database/bibleBooks';
import { volumeCodeForBook } from '@/database/sdaCommentary';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Label } from '@/components/ui/Typography';

export default function CommentaryBookListScreen() {
  const theme = useTheme();

  const sections = useMemo(() => {
    const available = BIBLE_BOOKS.filter((b) => volumeCodeForBook(b.name));
    return [
      { title: 'Old Testament', data: available.filter((b) => b.testament === 'old') },
      { title: 'New Testament', data: available.filter((b) => b.testament === 'new') },
    ].filter((s) => s.data.length > 0);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.name}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        ListHeaderComponent={
          <Body style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.md, fontSize: theme.fontSize.sm }}>
            S.D.A. Bible Commentary (vols. 1-6): verse-by-verse notes from Ellen G. White's
            writings. Only the Bible books covered by these volumes are listed.
          </Body>
        }
        renderSectionHeader={({ section }) => (
          <Label style={{ marginTop: theme.spacing.md, marginBottom: theme.spacing.sm }}>{section.title}</Label>
        )}
        renderItem={({ item }) => (
          <PressableScale
            onPress={() => router.push({ pathname: '/more/commentary/[book]', params: { book: item.name } })}
            scaleTo={0.99}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.border,
                padding: theme.spacing.md,
                marginBottom: theme.spacing.xs + 2,
              }}
            >
              <Body style={{ flex: 1 }}>{item.name}</Body>
              <ChevronRight size={16} color={theme.colors.textFaint} />
            </View>
          </PressableScale>
        )}
        stickySectionHeadersEnabled={false}
      />
    </SafeAreaView>
  );
}
