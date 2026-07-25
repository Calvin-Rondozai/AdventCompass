import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Check, CheckCircle2, Trash2 } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { createPrayer, deletePrayer, getPrayer, Prayer, togglePrayerStatus, updatePrayer } from '@/database/prayer';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Label } from '@/components/ui/Typography';

export default function PrayerEditorScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ id: string }>();
  const isNew = params.id === 'new';

  const [existing, setExisting] = useState<Prayer | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (isNew) return;
    getPrayer(db, Number(params.id)).then((prayer) => {
      if (!prayer) return;
      setExisting(prayer);
      setTitle(prayer.title);
      setContent(prayer.content);
    });
  }, [db, isNew, params.id]);

  const handleSave = useCallback(async () => {
    if (!title.trim() && !content.trim()) {
      router.back();
      return;
    }
    if (isNew) {
      await createPrayer(db, { title: title.trim() || 'Untitled', content });
    } else if (existing) {
      await updatePrayer(db, existing.id, { title: title.trim() || 'Untitled', content });
    }
    router.back();
  }, [db, isNew, existing, title, content]);

  const handleDelete = useCallback(async () => {
    if (existing) {
      await deletePrayer(db, existing.id);
      router.back();
    }
  }, [db, existing]);

  const handleToggleStatus = useCallback(async () => {
    if (!existing) return;
    await togglePrayerStatus(db, existing.id);
    setExisting({ ...existing, status: existing.status === 'praying' ? 'answered' : 'praying' });
  }, [db, existing]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isNew ? 'New Prayer' : 'Edit Prayer',
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {!isNew && existing && (
            <>
              <PressableScale onPress={handleToggleStatus} style={{ padding: theme.spacing.xs }}>
                <CheckCircle2
                  size={20}
                  color={existing.status === 'answered' ? theme.colors.success : theme.colors.text}
                  fill={existing.status === 'answered' ? theme.colors.success : 'transparent'}
                  strokeWidth={1.75}
                />
              </PressableScale>
              <PressableScale onPress={handleDelete} style={{ padding: theme.spacing.xs }}>
                <Trash2 size={20} color={theme.colors.danger} strokeWidth={1.75} />
              </PressableScale>
            </>
          )}
          <PressableScale onPress={handleSave} style={{ padding: theme.spacing.xs }}>
            <Check size={22} color={theme.colors.primary} strokeWidth={2.25} />
          </PressableScale>
        </View>
      ),
    });
  }, [navigation, theme, isNew, existing, handleSave, handleDelete, handleToggleStatus]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={[]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        {existing && (
          <Label>
            {new Date(existing.date).toLocaleDateString()} · {existing.status === 'answered' ? 'Answered' : 'Praying'}
          </Label>
        )}
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Prayer request"
          placeholderTextColor={theme.colors.textFaint}
          style={{
            fontFamily: theme.fontFamily.serifSemiBold,
            fontSize: theme.fontSize.xl,
            color: theme.colors.text,
          }}
        />
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="Details, updates, and reflections…"
          placeholderTextColor={theme.colors.textFaint}
          multiline
          textAlignVertical="top"
          style={{
            fontFamily: theme.fontFamily.sansRegular,
            fontSize: theme.fontSize.base,
            lineHeight: theme.lineHeight.base,
            color: theme.colors.text,
            minHeight: 200,
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
