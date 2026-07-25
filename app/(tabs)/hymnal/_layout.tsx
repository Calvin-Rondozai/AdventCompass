import { Stack } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';

export default function HymnalStackLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontFamily: theme.fontFamily.serifSemiBold, fontSize: theme.fontSize.md },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Hymnal' }} />
      <Stack.Screen name="[language]" options={{ title: '' }} />
      <Stack.Screen name="[language]/[number]" options={{ title: '' }} />
    </Stack>
  );
}
