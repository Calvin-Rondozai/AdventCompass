import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { BookOpen } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

// Shared between the downloaded-quarters grid (app/(tabs)/more/sabbath-school.tsx) and the
// age-division library (app/(tabs)/more/sabbath-school/books.tsx) — the cover fills however
// much width its column gets and grows tall enough to match that width's 3:4 aspect ratio,
// falling back to a plain icon tile if the cover fails to load (e.g. a guessed URL for a
// division/quarter that hasn't actually been published in that language yet).
export function CoverThumbFull({ uri }: { uri: string | null }) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View
        style={{
          width: '100%',
          aspectRatio: 3 / 4,
          borderRadius: theme.radius.sm,
          backgroundColor: theme.colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <BookOpen size={48} color={theme.colors.accent} strokeWidth={1.75} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      onError={() => setFailed(true)}
      style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceMuted }}
      resizeMode="cover"
    />
  );
}
