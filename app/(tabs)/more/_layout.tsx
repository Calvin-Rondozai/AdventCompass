import { Stack } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';

// Hiding the bottom tab bar for More's sub-screens (content/reading screens where it's just
// wasted space) is computed directly from the route in app/(tabs)/_layout.tsx — no local
// state needed here.
export default function MoreStackLayout() {
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
      <Stack.Screen name="index" options={{ title: 'More' }} />
      <Stack.Screen name="devotional" options={{ title: 'Devotions' }} />
      <Stack.Screen name="reading-plans" options={{ title: 'Reading Plans' }} />
      <Stack.Screen name="reading-plans/new" options={{ title: 'New Plan' }} />
      <Stack.Screen name="reading-plans/[planId]" options={{ title: '' }} />
      <Stack.Screen name="offertory" options={{ title: 'Offertory Reading' }} />
      <Stack.Screen name="prayer" options={{ title: 'Prayer Journal' }} />
      <Stack.Screen name="prayer/[id]" options={{ title: '', presentation: 'modal' }} />
      <Stack.Screen name="health" options={{ title: 'Health & Wellness' }} />
      <Stack.Screen name="egw" options={{ title: 'Ellen G. White Books' }} />
      <Stack.Screen name="egw/[code]" options={{ title: '' }} />
      <Stack.Screen name="egw/[code]/[number]" options={{ title: '' }} />
      <Stack.Screen name="beliefs" options={{ title: 'Fundamental Beliefs' }} />
      <Stack.Screen name="beliefs/[number]" options={{ title: '' }} />
      <Stack.Screen name="commentary" options={{ title: 'Bible Commentary' }} />
      <Stack.Screen name="commentary/[book]" options={{ title: '' }} />
      <Stack.Screen name="commentary/[book]/[chapter]" options={{ title: '' }} />
      <Stack.Screen name="sabbath-school" options={{ title: 'Sabbath School' }} />
      <Stack.Screen name="sabbath-school/[id]" options={{ title: '' }} />
      <Stack.Screen name="sabbath-school/[id]/[week]" options={{ title: '' }} />
      <Stack.Screen name="topical-verses" options={{ title: 'Topical Verses' }} />
      <Stack.Screen name="topical-verses/[topic]" options={{ title: '' }} />
      <Stack.Screen name="childrens-sermons" options={{ title: "Children's Sermons" }} />
      <Stack.Screen name="childrens-sermons/[id]" options={{ title: '' }} />
      <Stack.Screen name="ai-assistant" options={{ title: 'AI Bible Assistant' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="notifications" options={{ title: 'Reminders' }} />
      <Stack.Screen name="about" options={{ title: 'About' }} />
    </Stack>
  );
}
