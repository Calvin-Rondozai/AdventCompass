import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { getKv, setKv } from '@/database/kv';
import { darkColors, lightColors, ThemeColors } from './colors';
import { fontFamily, fontSize, lineHeight } from './typography';
import { motion, radius, shadow, spacing } from './spacing';

export type ThemePreference = 'system' | 'light' | 'dark';
const THEME_PREFERENCE_KEY = 'theme_preference';

type Theme = {
  colors: ThemeColors;
  scheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  fontFamily: typeof fontFamily;
  fontSize: typeof fontSize;
  lineHeight: typeof lineHeight;
  spacing: typeof spacing;
  radius: typeof radius;
  motion: typeof motion;
  shadow: typeof shadow;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const systemScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    getKv(db, THEME_PREFERENCE_KEY)
      .then((value) => {
        if (value === 'light' || value === 'dark' || value === 'system') setPreferenceState(value);
      })
      .catch(() => {});
  }, [db]);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    setKv(db, THEME_PREFERENCE_KEY, next).catch(() => {});
  };

  const scheme = preference === 'system' ? systemScheme : preference;

  const theme = useMemo<Theme>(
    () => ({
      colors: scheme === 'dark' ? darkColors : lightColors,
      scheme,
      preference,
      setPreference,
      fontFamily,
      fontSize,
      lineHeight,
      spacing,
      radius,
      motion,
      shadow,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scheme, preference]
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
