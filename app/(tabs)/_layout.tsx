import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import { BookOpen, Home, MoreHorizontal, Music, NotebookPen } from '@/components/ui/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { useTabBarVisibility } from '@/hooks/useTabBarVisibility';
import { AnimatedTabIcon } from '@/components/navigation/AnimatedTabIcon';

export default function TabsLayout() {
  const theme = useTheme();
  const { visible: scrollVisible } = useTabBarVisibility();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  // Computed directly from the route on every render (instead of round-tripping through a
  // separate context + useEffect in more/_layout.tsx) so the bar's visibility change lands in
  // the same render pass as the navigation transition. Scroll-driven hiding (bible chapter
  // reader) still goes through the context since that's genuinely gesture-driven, not
  // route-driven.
  const hiddenForMoreSubscreen = pathname.startsWith('/more') && pathname !== '/more';
  // Both the per-language hymn list ("/hymnal/en") and an individual hymn's reading screen
  // ("/hymnal/en/123") hide the bar the same way a More sub-screen does; only the language
  // picker itself ("/hymnal") keeps it.
  const hymnalSegments = pathname.startsWith('/hymnal/') ? pathname.split('/').filter(Boolean) : [];
  const hiddenForHymnDetail = hymnalSegments.length >= 2;
  const visible = scrollVisible && !hiddenForMoreSubscreen && !hiddenForHymnDetail;
  // The system nav bar (3-button or gesture pill) sits below the screen's safe area —
  // insets.bottom already accounts for either case, so add it on top of our own
  // content height instead of using a fixed height that ignores it.
  const barContentHeight = 58;
  const barHeight = barContentHeight + insets.bottom;

  // Toggling `display: none/flex` (the old approach) is instant — no property to animate —
  // which is exactly the "blink" this replaces. expo-router's own vendored BottomTabBar
  // (node_modules/expo-router/build/react-navigation/bottom-tabs/views/BottomTabBar.js)
  // already ships this exact slide+overlay technique for its `tabBarHideOnKeyboard` case, but
  // only wires it to keyboard visibility — there's no public prop to drive it from arbitrary
  // app state, so this reproduces the same technique for our own `visible` condition: while
  // hidden, the bar becomes `position: absolute` (so the screen content reflows into its
  // space immediately) while it's still animating a translateY off-screen on top of that
  // content, so the reflow itself is covered by the bar sliding away rather than visible as a
  // jump. Showing reverses it: slide up while still absolute/overlaying, then only drop back
  // to normal flow (reclaiming layout space) once fully back in view.
  const [barDetached, setBarDetached] = useState(!visible);
  const hideAnim = useRef(new Animated.Value(visible ? 0 : 1)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(hideAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setBarDetached(false);
      });
    } else {
      setBarDetached(true);
      Animated.timing(hideAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    }
  }, [visible, hideAnim]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textFaint,
        tabBarStyle: {
          position: barDetached ? 'absolute' : undefined,
          transform: [{ translateY: hideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, barHeight] }) }],
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: barHeight,
          paddingTop: 8,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: {
          fontFamily: theme.fontFamily.sansMedium,
          fontSize: 11,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <AnimatedTabIcon Icon={Home} focused={focused} color={color as string} dotColor={theme.colors.primary} />
          ),
        }}
      />
      <Tabs.Screen
        name="bible"
        options={{
          title: 'Bible',
          tabBarIcon: ({ focused, color }) => (
            <AnimatedTabIcon Icon={BookOpen} focused={focused} color={color as string} dotColor={theme.colors.primary} />
          ),
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: 'Notes',
          tabBarIcon: ({ focused, color }) => (
            <AnimatedTabIcon Icon={NotebookPen} focused={focused} color={color as string} dotColor={theme.colors.primary} />
          ),
        }}
      />
      <Tabs.Screen
        name="hymnal"
        options={{
          title: 'Hymnal',
          tabBarIcon: ({ focused, color }) => (
            <AnimatedTabIcon Icon={Music} focused={focused} color={color as string} dotColor={theme.colors.primary} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ focused, color }) => (
            <AnimatedTabIcon Icon={MoreHorizontal} focused={focused} color={color as string} dotColor={theme.colors.primary} />
          ),
        }}
      />
    </Tabs>
  );
}
