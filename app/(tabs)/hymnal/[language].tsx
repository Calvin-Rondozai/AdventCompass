import React, { useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { ChevronRight, Search as SearchIcon, X } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getHymns, HYMNALS, HymnalLanguage } from '@/database/hymnal';
import { HymnNumberJump } from '@/components/bible/HymnNumberJump';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body } from '@/components/ui/Typography';

export default function HymnalListScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { language } = useLocalSearchParams<{ language: HymnalLanguage }>();
  const lang = language ?? 'english';
  const info = HYMNALS.find((h) => h.code === lang);
  const hymns = getHymns(lang);

  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hymns;
    return hymns.filter((h) => h.title.toLowerCase().includes(q) || h.lyrics.toLowerCase().includes(q));
  }, [hymns, query]);

  const goToHymn = (number: number) => {
    router.push({ pathname: '/hymnal/[language]/[number]', params: { language: lang, number: String(number) } });
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: info?.label ?? 'Hymnal',
      headerRight: () => (
        <PressableScale
          onPress={() => {
            setShowSearch((v) => !v);
            setQuery('');
          }}
          style={{ padding: theme.spacing.xs }}
        >
          {showSearch ? (
            <X size={20} color={theme.colors.text} strokeWidth={1.75} />
          ) : (
            <SearchIcon size={20} color={theme.colors.text} strokeWidth={1.75} />
          )}
        </PressableScale>
      ),
    });
  }, [navigation, info, theme, showSearch]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      {showSearch && (
        <View style={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.sm }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              paddingHorizontal: theme.spacing.sm,
            }}
          >
            <SearchIcon size={16} color={theme.colors.textFaint} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Search by title or words"
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
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(h) => String(h.number)}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        renderItem={({ item }) => (
          <PressableScale onPress={() => goToHymn(item.number)} scaleTo={0.99}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.border,
                padding: theme.spacing.md,
                marginBottom: theme.spacing.sm,
              }}
            >
              <Body style={{ width: 32, color: theme.colors.textFaint, fontFamily: theme.fontFamily.sansSemiBold }}>
                {item.number}
              </Body>
              <Body style={{ flex: 1, fontFamily: theme.fontFamily.sansMedium }}>{item.title}</Body>
              <ChevronRight size={16} color={theme.colors.textFaint} />
            </View>
          </PressableScale>
        )}
      />

      <HymnNumberJump language={lang} />
    </SafeAreaView>
  );
}
