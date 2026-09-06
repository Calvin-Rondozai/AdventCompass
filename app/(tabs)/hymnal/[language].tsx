import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Grid3x3, Heart, Library, Search as SearchIcon, X } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getHymns, HYMNAL_LAST_LANGUAGE_KEY, HYMNALS, HymnalLanguage } from '@/database/hymnal';
import { getFavoriteHymnNumbers, toggleHymnFavorite } from '@/database/hymnFavorites';
import { setKv } from '@/database/kv';
import { HymnNumberJump, HymnNumberJumpHandle } from '@/components/bible/HymnNumberJump';
import { HymnalLanguageSheet, HymnalLanguageSheetHandle } from '@/components/hymnal/HymnalLanguageSheet';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Heading } from '@/components/ui/Typography';

export default function HymnalListScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const db = useSQLiteContext();
  const { language } = useLocalSearchParams<{ language: HymnalLanguage }>();
  const lang = language ?? 'english';
  const info = HYMNALS.find((h) => h.code === lang);
  const hymns = getHymns(lang);

  const jumpRef = useRef<HymnNumberJumpHandle>(null);
  const languageSheetRef = useRef<HymnalLanguageSheetHandle>(null);

  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  useEffect(() => {
    setKv(db, HYMNAL_LAST_LANGUAGE_KEY, lang).catch(() => {});
  }, [db, lang]);

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
    if (!q) return hymns;
    return hymns.filter((h) => h.title.toLowerCase().includes(q) || h.lyrics.toLowerCase().includes(q));
  }, [hymns, query]);

  const goToHymn = (number: number) => {
    router.push({ pathname: '/hymnal/[language]/[number]', params: { language: lang, number: String(number) } });
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
          <PressableScale onPress={() => jumpRef.current?.open()} style={{ padding: theme.spacing.xs }}>
            <Grid3x3 size={20} color={theme.colors.text} strokeWidth={1.75} />
          </PressableScale>
          <PressableScale onPress={() => languageSheetRef.current?.open()} style={{ padding: theme.spacing.xs }}>
            <Library size={20} color={theme.colors.text} strokeWidth={1.75} />
          </PressableScale>
        </View>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, theme, showSearch]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md }}>
        <Heading style={{ fontSize: theme.fontSize.xxl }}>{info?.label ?? 'Hymnal'}</Heading>
        <View style={{ width: 48, height: 3, borderRadius: 2, backgroundColor: theme.colors.accent, marginTop: theme.spacing.sm }} />
      </View>

      {showSearch && (
        <View style={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.sm }}>
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
        contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.xxl }}
        renderItem={({ item, index }) => {
          const isFavorite = favorites.has(item.number);
          return (
            <PressableScale onPress={() => goToHymn(item.number)} scaleTo={0.99}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: theme.spacing.md,
                  borderBottomWidth: index === filtered.length - 1 ? 0 : 1,
                  borderBottomColor: theme.colors.border,
                }}
              >
                <Body style={{ width: 40, color: theme.colors.textFaint, fontFamily: theme.fontFamily.sansSemiBold }}>
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
              </View>
            </PressableScale>
          );
        }}
      />

      <HymnNumberJump ref={jumpRef} language={lang} hideTrigger />
      <HymnalLanguageSheet ref={languageSheetRef} currentLanguage={lang} />
    </SafeAreaView>
  );
}
