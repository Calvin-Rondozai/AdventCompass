import { useEffect } from 'react';
import { Stack, usePathname } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { useTabBarVisibility } from '@/hooks/useTabBarVisibility';

export default function MoreStackLayout() {
  const theme = useTheme();
  const pathname = usePathname();
  const { setVisible: setTabBarVisible } = useTabBarVisibility();

  // Any screen under More other than its own menu should hide the bottom tab bar —
  // these are content/reading screens (devotional, hymnal, EGW books, settings, etc.)
  // where the tab bar is just wasted space. Centralized here instead of per-screen so
  // every current and future More sub-screen gets this for free.
  //
  // This layout stays mounted even after you switch to a different tab (Home, Bible,
  // Notes, Prayer), and usePathname() reports the *global* route — so without the
  // startsWith guard, leaving More for another tab would still run this effect and
  // force the tab bar hidden everywhere, since the last-seen pathname was some
  // "/more/..." sub-screen. Only assert visibility while actually inside /more; once
  // pathname moves elsewhere, explicitly restore it since only More's own sub-screens
  // ever hide it.
  useEffect(() => {
    if (pathname.startsWith('/more')) {
      setTabBarVisible(pathname === '/more');
    } else {
      setTabBarVisible(true);
    }
  }, [pathname, setTabBarVisible]);

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
      <Stack.Screen name="hymnal" options={{ title: 'Hymnal' }} />
      <Stack.Screen name="hymnal/[language]" options={{ title: '' }} />
      <Stack.Screen name="hymnal/[language]/[number]" options={{ title: '' }} />
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
      <Stack.Screen name="ai-assistant" options={{ title: 'AI Bible Assistant' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="notifications" options={{ title: 'Reminders' }} />
      <Stack.Screen name="about" options={{ title: 'About' }} />
    </Stack>
  );
}
