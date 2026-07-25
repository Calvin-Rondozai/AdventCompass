import React, { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { HeartHandshake, Plus, CheckCircle2 } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getPrayers, Prayer, PrayerStatus, togglePrayerStatus } from '@/database/prayer';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Heading, Label } from '@/components/ui/Typography';

const FILTERS: { key: PrayerStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'praying', label: 'Praying' },
  { key: 'answered', label: 'Answered' },
];

export default function PrayerListScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const [filter, setFilter] = useState<PrayerStatus | 'all'>('all');
  const [prayers, setPrayers] = useState<Prayer[]>([]);

  const refresh = useCallback(() => {
    getPrayers(db, filter === 'all' ? undefined : filter).then(setPrayers);
  }, [db, filter]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleToggleStatus = useCallback(
    async (id: number) => {
      await togglePrayerStatus(db, id);
      refresh();
    },
    [db, refresh]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={[]}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, padding: theme.spacing.lg, paddingBottom: theme.spacing.sm }}>
        {FILTERS.map((f) => (
          <PressableScale key={f.key} onPress={() => setFilter(f.key)} scaleTo={0.96}>
            <View
              style={{
                paddingVertical: theme.spacing.xs + 2,
                paddingHorizontal: theme.spacing.sm + 2,
                borderRadius: theme.radius.pill,
                backgroundColor: filter === f.key ? theme.colors.primary : theme.colors.surfaceMuted,
              }}
            >
              <Body
                style={{
                  fontSize: theme.fontSize.sm,
                  color: filter === f.key ? theme.colors.onPrimary : theme.colors.textMuted,
                  fontFamily: theme.fontFamily.sansMedium,
                }}
              >
                {f.label}
              </Body>
            </View>
          </PressableScale>
        ))}
      </View>

      <FlatList
        data={prayers}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, paddingBottom: theme.spacing.xxl }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: theme.spacing.xxl, gap: theme.spacing.sm }}>
            <HeartHandshake size={32} color={theme.colors.textFaint} strokeWidth={1.5} />
            <Heading style={{ fontSize: theme.fontSize.md }}>No prayers here</Heading>
            <Body style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
              Tap the + button to add a prayer request.
            </Body>
          </View>
        }
        renderItem={({ item }) => {
          const isAnswered = item.status === 'answered';
          return (
            <PressableScale
              onPress={() => router.push({ pathname: '/more/prayer/[id]', params: { id: String(item.id) } })}
              scaleTo={0.99}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  padding: theme.spacing.md,
                  marginBottom: theme.spacing.sm,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }} numberOfLines={1}>
                    {item.title || 'Untitled'}
                  </Body>
                  {!!item.content && (
                    <Body style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm, marginTop: 2 }} numberOfLines={2}>
                      {item.content}
                    </Body>
                  )}
                  <Label style={{ marginTop: theme.spacing.xs }}>
                    {new Date(item.date).toLocaleDateString()} · {isAnswered ? 'Answered' : 'Praying'}
                  </Label>
                </View>
                <PressableScale onPress={() => handleToggleStatus(item.id)} scaleTo={0.85}>
                  <CheckCircle2
                    size={24}
                    color={isAnswered ? theme.colors.success : theme.colors.textFaint}
                    fill={isAnswered ? theme.colors.success : 'transparent'}
                    strokeWidth={1.75}
                  />
                </PressableScale>
              </View>
            </PressableScale>
          );
        }}
      />

      <PressableScale
        onPress={() => router.push({ pathname: '/more/prayer/[id]', params: { id: 'new' } })}
        style={{ position: 'absolute', right: theme.spacing.lg, bottom: theme.spacing.lg }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            ...theme.shadow.floating,
          }}
        >
          <Plus size={24} color={theme.colors.onPrimary} strokeWidth={2.4} />
        </View>
      </PressableScale>
    </SafeAreaView>
  );
}
