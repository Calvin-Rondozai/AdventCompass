type GradientTriple = [string, string, string];
type GradientPair = [string, string];

// Brand palette: primary #2563EB, secondary #60A5FA, accent (gold) #D4AF37, light bg
// #F8FAFC, dark bg #0B1120. Secondary stands in as the dark-mode primary (lighter blue
// reads better on a near-black background — the light/dark pair is the same brand blue,
// same convention as Tailwind's blue-600/blue-400).
export const lightColors = {
  background: '#F8FAFC',
  backgroundAlt: '#EEF2F7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#EEF2F7',
  border: '#DCE3EC',

  primary: '#2563EB',
  primarySoft: '#DBEAFE',
  onPrimary: '#FFFFFF',

  accent: '#D4AF37',
  accentSoft: '#F8EFD1',
  onAccent: '#2A2205',

  text: '#0B1120',
  textMuted: '#4B5563',
  textFaint: '#94A3B8',

  success: '#1E8A5B',
  successSoft: '#DFF4EA',
  danger: '#C2410C',

  gradientHero: ['#1E3A8A', '#2563EB', '#60A5FA'] as GradientTriple,
  gradientCard: ['#FFFFFF', '#EEF2F7'] as GradientPair,
};

export const darkColors: typeof lightColors = {
  background: '#000000',
  backgroundAlt: '#0D0D0D',
  surface: '#121212',
  surfaceElevated: '#1C1C1C',
  surfaceMuted: '#161616',
  border: '#2A2A2A',

  primary: '#60A5FA',
  primarySoft: '#1E3A5F',
  onPrimary: '#0B1120',

  accent: '#D4AF37',
  accentSoft: '#2A2205',
  onAccent: '#FFF6DC',

  text: '#F1F5F9',
  textMuted: '#94A3B8',
  textFaint: '#64748B',

  success: '#4ADE94',
  successSoft: '#173829',
  danger: '#FB923C',

  gradientHero: ['#0B1120', '#1E3A8A', '#60A5FA'] as GradientTriple,
  gradientCard: ['#16203A', '#131B2C'] as GradientPair,
};

export type ThemeColors = typeof lightColors;
