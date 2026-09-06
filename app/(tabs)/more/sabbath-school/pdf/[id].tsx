import React, { useEffect, useLayoutEffect, useMemo } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { useTheme } from '@/theme/ThemeProvider';
import { getPdfLesson, SabbathPdfFile, SabbathPdfLesson } from '@/database/sabbathPdfLessons';
import { openPdf } from '@/services/openPdf';
import { PageLoader } from '@/components/ui/PageLoader';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Label } from '@/components/ui/Typography';

type WeekRow = { week: number | null; student?: SabbathPdfFile; teacher?: SabbathPdfFile };

export default function SabbathPdfLessonScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lesson, setLesson] = React.useState<SabbathPdfLesson | null>(null);
  const [loading, setLoading] = React.useState(true);

  useEffect(() => {
    if (!id) return;
    getPdfLesson(db, id).then((result) => {
      setLesson(result);
      setLoading(false);
    });
  }, [db, id]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: lesson?.title ?? 'Sabbath School' });
  }, [navigation, lesson]);

  const weeks = useMemo<WeekRow[]>(() => {
    if (!lesson) return [];
    const map = new Map<number | null, WeekRow>();
    for (const file of lesson.files) {
      const row = map.get(file.week) ?? { week: file.week };
      if (file.isTeacher) row.teacher = file;
      else row.student = file;
      map.set(file.week, row);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.week === null) return -1;
      if (b.week === null) return 1;
      return a.week - b.week;
    });
  }, [lesson]);

  if (loading) return <PageLoader />;

  if (!lesson) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
        <Body style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing.lg }}>
          This lesson set couldn't be found — it may have been deleted.
        </Body>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <FlatList
        data={weeks}
        keyExtractor={(item) => String(item.week)}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl, gap: theme.spacing.sm }}
        ListHeaderComponent={
          lesson.humanDate ? (
            <Body style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.md }}>{lesson.humanDate}</Body>
          ) : null
        }
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.md,
              ...theme.shadow.subtle,
            }}
          >
            <Body style={{ flex: 1, fontFamily: theme.fontFamily.sansSemiBold }}>
              {item.week === null ? 'Introduction' : `Lesson ${item.week}`}
            </Body>
            {item.student && (
              <PressableScale
                onPress={() => openPdf(item.student!.uri)}
                style={{ paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs }}
              >
                <Label style={{ color: theme.colors.primary, fontFamily: theme.fontFamily.sansSemiBold }}>Student</Label>
              </PressableScale>
            )}
            {item.teacher && (
              <PressableScale
                onPress={() => openPdf(item.teacher!.uri)}
                style={{ paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs }}
              >
                <Label style={{ color: theme.colors.accent, fontFamily: theme.fontFamily.sansSemiBold }}>Teacher</Label>
              </PressableScale>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}
