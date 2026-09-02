import React, { useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Check, Search as SearchIcon } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { BIBLE_BOOKS } from '@/database/bibleBooks';
import { buildRangePlan } from '@/database/readingPlans';
import { addCustomPlan } from '@/database/customReadingPlans';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Label } from '@/components/ui/Typography';

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export default function NewReadingPlanScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const [bookQuery, setBookQuery] = useState('');
  const [book, setBook] = useState<string | null>(null);
  const [startChapter, setStartChapter] = useState('1');
  const [endChapter, setEndChapter] = useState('');
  const [days, setDays] = useState('');

  const bookInfo = useMemo(() => BIBLE_BOOKS.find((b) => b.name === book), [book]);
  const matchingBooks = useMemo(() => {
    const target = normalize(bookQuery);
    if (!target) return [];
    return BIBLE_BOOKS.filter((b) => normalize(b.name).includes(target)).slice(0, 8);
  }, [bookQuery]);

  const maxChapters = bookInfo?.chapters ?? 0;
  const start = Math.max(1, Math.min(Number(startChapter) || 1, maxChapters));
  const end = Math.max(start, Math.min(Number(endChapter) || maxChapters, maxChapters));
  const totalChapters = end - start + 1;
  const numDays = Math.max(1, Math.min(Number(days) || totalChapters, totalChapters));

  const canCreate = !!book && totalChapters > 0;

  const handleCreate = async () => {
    if (!book) return;
    const id = `custom-${Date.now()}`;
    const title = `${book} ${start}${end > start ? `-${end}` : ''}`;
    await addCustomPlan(db, {
      id,
      title,
      description: `${numDays} day${numDays > 1 ? 's' : ''} · your own plan`,
      days: buildRangePlan(book, start, end, numDays),
    });
    router.replace({ pathname: '/more/reading-plans/[planId]', params: { planId: id } });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        {!book ? (
          <>
            <Label>Book</Label>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.lg,
                paddingHorizontal: theme.spacing.sm,
                ...theme.shadow.subtle,
              }}
            >
              <SearchIcon size={16} color={theme.colors.textFaint} />
              <TextInput
                value={bookQuery}
                onChangeText={setBookQuery}
                placeholder="Search for a book"
                placeholderTextColor={theme.colors.textFaint}
                style={{
                  flex: 1,
                  padding: theme.spacing.sm,
                  color: theme.colors.text,
                  fontFamily: theme.fontFamily.sansRegular,
                  fontSize: theme.fontSize.base,
                }}
              />
            </View>
            <FlatList
              data={matchingBooks}
              keyExtractor={(b) => b.name}
              renderItem={({ item, index }) => (
                <PressableScale onPress={() => setBook(item.name)} scaleTo={0.99}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      paddingVertical: theme.spacing.sm + 2,
                      borderBottomWidth: index === matchingBooks.length - 1 ? 0 : 1,
                      borderBottomColor: theme.colors.border,
                    }}
                  >
                    <Body>{item.name}</Body>
                    <Body style={{ color: theme.colors.textFaint, fontSize: theme.fontSize.sm }}>{item.chapters} ch</Body>
                  </View>
                </PressableScale>
              )}
            />
          </>
        ) : (
          <>
            <PressableScale onPress={() => setBook(null)} scaleTo={0.98}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: theme.colors.primarySoft,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.sm + 2,
                }}
              >
                <Body style={{ fontFamily: theme.fontFamily.sansSemiBold, color: theme.colors.primary }}>{book}</Body>
                <Label style={{ color: theme.colors.primary }}>Change</Label>
              </View>
            </PressableScale>

            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Label style={{ marginBottom: theme.spacing.xs }}>Start chapter</Label>
                <TextInput
                  value={startChapter}
                  onChangeText={setStartChapter}
                  keyboardType="number-pad"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radius.lg,
                    padding: theme.spacing.sm + 2,
                    color: theme.colors.text,
                    ...theme.shadow.subtle,
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Label style={{ marginBottom: theme.spacing.xs }}>End chapter</Label>
                <TextInput
                  value={endChapter}
                  onChangeText={setEndChapter}
                  keyboardType="number-pad"
                  placeholder={String(maxChapters)}
                  placeholderTextColor={theme.colors.textFaint}
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radius.lg,
                    padding: theme.spacing.sm + 2,
                    color: theme.colors.text,
                    ...theme.shadow.subtle,
                  }}
                />
              </View>
            </View>

            <View>
              <Label style={{ marginBottom: theme.spacing.xs }}>Number of days</Label>
              <TextInput
                value={days}
                onChangeText={setDays}
                keyboardType="number-pad"
                placeholder={`${totalChapters} (1 chapter/day)`}
                placeholderTextColor={theme.colors.textFaint}
                style={{
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radius.lg,
                  padding: theme.spacing.sm + 2,
                  color: theme.colors.text,
                  ...theme.shadow.subtle,
                }}
              />
            </View>

            <PressableScale onPress={handleCreate} scaleTo={0.98} disabled={!canCreate}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: theme.spacing.xs,
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.sm + 4,
                  opacity: canCreate ? 1 : 0.5,
                }}
              >
                <Check size={18} color={theme.colors.onPrimary} />
                <Body style={{ color: theme.colors.onPrimary, fontFamily: theme.fontFamily.sansSemiBold }}>
                  Create Plan
                </Body>
              </View>
            </PressableScale>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
