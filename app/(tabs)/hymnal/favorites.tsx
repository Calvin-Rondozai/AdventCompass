import React, { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Heart } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getHymn, HYMNALS } from '@/database/hymnal';
import { getFavoriteHymns, HymnFavorite, toggleHymnFavorite } from '@/database/hymnFavorites';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Label } from '@/components/ui/Typography';

// Shows each favorited hymn in whichever language it was favorited in — not always
// English — since that's the version the person actually meant when they marked it.
export default function HymnFavoritesScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const [favorites, setFavorites] = useState<HymnFavorite[]>([]);

  useFocusEffect(
    useCallback(() => {
      getFavoriteHymns(db).then(setFavorites);
    }, [db])
  );

  const handleRemove = (fav: HymnFavorite) => {
    toggleHymnFavorite(db, fav.language, fav.number).then(() => {
      setFavorites((prev) => prev.filter((f) => f.number !== fav.number));
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <FlatList
        data={favorites}
        keyExtractor={(f) => String(f.number)}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        ListEmptyComponent={
          <Body style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing.xl }}>
            No favorite hymns yet — open a hymn and tap the heart to add one.
          </Body>
        }
        renderItem={({ item, index }) => {
          const hymn = getHymn(item.language, item.number);
          const languageLabel = HYMNALS.find((h) => h.code === item.language)?.label ?? item.language;
          return (
            <PressableScale
              onPress={() =>
                router.push({ pathname: '/hymnal/[language]/[number]', params: { language: item.language, number: String(item.number) } })
              }
              scaleTo={0.99}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: theme.spacing.md,
                  borderBottomWidth: index === favorites.length - 1 ? 0 : 1,
                  borderBottomColor: theme.colors.border,
                }}
              >
                <Body style={{ width: 40, color: theme.colors.textFaint, fontFamily: theme.fontFamily.sansSemiBold }}>
                  {item.number}
                </Body>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontFamily: theme.fontFamily.sansMedium }}>{hymn?.title ?? 'Untitled'}</Body>
                  <Label style={{ marginTop: 2 }}>{languageLabel}</Label>
                </View>
                <PressableScale onPress={() => handleRemove(item)} scaleTo={0.8} style={{ padding: 4 }}>
                  <Heart size={18} color={theme.colors.danger} fill={theme.colors.danger} strokeWidth={1.75} />
                </PressableScale>
              </View>
            </PressableScale>
          );
        }}
      />
    </SafeAreaView>
  );
}
