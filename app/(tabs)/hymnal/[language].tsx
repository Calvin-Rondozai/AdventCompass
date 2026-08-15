import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ChevronRight, Heart, Search as SearchIcon, X } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getHymns, HYMNALS, HymnalLanguage } from '@/database/hymnal';
import { getFavoriteHymnNumbers, toggleHymnFavorite } from '@/database/hymnFavorites';
import { HymnNumberJump } from '@/components/bible/HymnNumberJump';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body } from '@/components/ui/Typography';

export default function HymnalListScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const db = useSQLiteContext();
  const { language } = useLocalSearchParams<{ language: HymnalLanguage }>();
  const lang = language ?? 'english';
  const info = HYMNALS.find((h) => h.code === lang);
  const hymns = getHymns(lang);

  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getFavoriteHymnNumbers(db).then(setFavorites);
    }, [db])
  );

  // Favorite-ness is global by hymn number, shared across every language, but favoriting
  // from here remembers THIS language as the one it was marked in — see
  // database/hymnFavorites.ts and the dedicated cross-language Favorites screen.
  const handleToggleFavorite = (number: number) => {
    toggleHymnFavorite(db, lang, number).then((isFavorite) => {
      setFavorites((prev) => {
        const next = new Set(prev);
        if (isFavorite) next.add(number);
        else next.delete(number);
        return next;
      });
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = hymns;
    if (showFavoritesOnly) list = list.filter((h) => favorites.has(h.number));
    if (q) list = list.filter((h) => h.title.toLowerCase().includes(q) || h.lyrics.toLowerCase().includes(q));
    return list;
  }, [hymns, query, showFavoritesOnly, favorites]);

  const goToHymn = (number: number) => {
    router.push({ pathname: '/hymnal/[language]/[number]', params: { language: lang, number: String(number) } });
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: info?.label ?? 'Hymnal',
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <PressableScale onPress={() => setShowFavoritesOnly((v) => !v)} style={{ padding: theme.spacing.xs }}>
            <Heart
              size={20}
              color={showFavoritesOnly ? theme.colors.danger : theme.colors.text}
              fill={showFavoritesOnly ? theme.colors.danger : undefined}
              strokeWidth={1.75}
            />
          </PressableScale>
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
        </View>
      ),
    });
  }, [navigation, info, theme, showSearch, showFavoritesOnly]);

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
        ListEmptyComponent={
          showFavoritesOnly ? (
            <Body style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing.xl }}>
              No favorite hymns yet — tap the heart on a hymn to add one.
            </Body>
          ) : null
        }
        renderItem={({ item }) => {
          const isFavorite = favorites.has(item.number);
          return (
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
                <PressableScale onPress={() => handleToggleFavorite(item.number)} scaleTo={0.8} style={{ padding: 4 }}>
                  <Heart
                    size={18}
                    color={isFavorite ? theme.colors.danger : theme.colors.textFaint}
                    fill={isFavorite ? theme.colors.danger : undefined}
                    strokeWidth={1.75}
                  />
                </PressableScale>
                <ChevronRight size={16} color={theme.colors.textFaint} />
              </View>
            </PressableScale>
          );
        }}
      />

      <HymnNumberJump language={lang} />
    </SafeAreaView>
  );
}
