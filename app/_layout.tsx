import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, LogBox } from 'react-native';
import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavDefaultTheme,
  router,
  Stack,
  ThemeProvider as NavigationThemeProvider,
  usePathname,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getKv } from '@/database/kv';
import { useTheme } from '@/theme/ThemeProvider';

// moti re-exports a SafeAreaView from its own bundle that internally imports the
// deprecated React Native one — the warning fires just from moti being loaded, not
// from any SafeAreaView we render (every screen already uses
// react-native-safe-area-context). Nothing to fix on our end; silence the noise.
LogBox.ignoreLogs(['SafeAreaView has been deprecated']);
import { useFonts, Lora_400Regular, Lora_500Medium, Lora_600SemiBold, Lora_700Bold } from '@expo-google-fonts/lora';
import {
  Raleway_300Light,
  Raleway_400Regular,
  Raleway_500Medium,
  Raleway_600SemiBold,
  Raleway_700Bold,
} from '@expo-google-fonts/raleway';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { DATABASE_NAME, migrateDbIfNeeded } from '@/database/migrate';
import { TabBarVisibilityProvider } from '@/hooks/useTabBarVisibility';
import { syncSabbathSchool } from '@/services/sabbathSchoolSync';
import { refreshSabbathSchoolReminder } from '@/services/notifications';
import { AppAlertHost } from '@/components/ui/AppAlert';
import { BrandedSplash } from '@/components/BrandedSplash';
// Registers the foreground notification handler on every launch — reminders are
// scheduled with the OS and survive restarts, but this in-memory handler config
// (how a notification behaves while the app is open) must be set up each session.
import '@/services/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

// The branded splash (logo + "AdventCompass" + "Powered by Hello C") is shown for at
// least this long regardless of how fast the app actually finishes loading — without a
// floor, a warm-cached launch could finish in a few hundred ms and the brand moment
// would barely register before snapping to the home tab.
const MIN_SPLASH_MS = 2000;

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Lora_400Regular,
    Lora_500Medium,
    Lora_600SemiBold,
    Lora_700Bold,
    Raleway_300Light,
    Raleway_400Regular,
    Raleway_500Medium,
    Raleway_600SemiBold,
    Raleway_700Bold,
  });
  const [dbReady, setDbReady] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // Hides the native OS splash (Android 12+'s SplashScreen API — icon + background
  // color only, see android/app/src/main/res/values/styles.xml) once fonts are ready,
  // immediately replaced by the BrandedSplash overlay below (both use the exact same
  // background color, so the handoff is imperceptible). Gated on fontsLoaded — NOT
  // called unconditionally on mount — on purpose: that first version raced ahead of
  // React Native's actual native paint. useEffect fires once React has committed the
  // update, but "committed" and "actually drawn to the screen" aren't the same instant
  // on the native side, and calling hideAsync() before BrandedSplash has genuinely
  // painted could reveal a blank native background instead of a clean handoff. Waiting
  // for fontsLoaded costs nothing (still well before dbReady/minTimeElapsed) and
  // guarantees at least one real render cycle has happened first.
  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  const appReady = fontsLoaded && dbReady && minTimeElapsed;

  // GestureHandlerRootView/SafeAreaProvider always render, fonts-loaded or not —
  // BrandedSplash needs react-native-safe-area-context's provider to position its
  // tagline off the real screen edge (see useSafeAreaInsets in that component), so it
  // can't be returned as an early, unwrapped `if (!fontsLoaded) return <BrandedSplash/>`
  // the way the image-only version could. The rest of the tree only mounts once fonts
  // are ready (unchanged from before); until then this renders as just the overlay.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {fontsLoaded && (
          <SQLiteProvider
            databaseName={DATABASE_NAME}
            onInit={migrateDbIfNeeded}
            onError={(error) => console.error('Database init failed', error)}
          >
            <ThemeProvider>
              <TabBarVisibilityProvider>
                <RootReady onReady={() => setDbReady(true)} />
              </TabBarVisibilityProvider>
            </ThemeProvider>
          </SQLiteProvider>
        )}
        {!appReady && <BrandedSplash />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootReady({ onReady }: { onReady: () => void }) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const pathname = usePathname();
  const lastAttempt = useRef(0);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  // Once the initial cold-start landing is confirmed, this effect must stop acting —
  // without this flag it kept re-firing on every pathname change for the rest of the
  // session (needsOnboarding is only ever fetched once, on mount), which meant finishing
  // onboarding and navigating to (tabs) got immediately overridden right back to
  // /onboarding. Its only job is fixing the cold-start route; after that, normal
  // navigation (like onboarding's own "Get Started" -> router.replace('/(tabs)')) must
  // be left alone.
  const settledRef = useRef(false);

  // expo-router's own NavigationContainer always defaults to a hardcoded light
  // theme (see expo-router/build/react-navigation/native/theming/DefaultTheme),
  // which react-native-screens paints natively behind every push transition —
  // that's the light flash seen when navigating in dark mode. Bridging our own
  // theme into React Navigation's ThemeProvider fixes it at the native layer.
  const navTheme = useMemo(() => {
    const base = theme.scheme === 'dark' ? NavDarkTheme : NavDefaultTheme;
    return {
      ...base,
      dark: theme.scheme === 'dark',
      colors: {
        ...base.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.danger,
      },
    };
  }, [theme]);

  useEffect(() => {
    getKv(db, 'onboarding_complete')
      .then((v) => {
        setNeedsOnboarding(v !== '1');
      })
      .catch((error) => {
        // needsOnboarding starting (and staying) null blocks the effect below from
        // ever calling onReady() — that's the one thing hiding the native splash
        // screen in the parent, so a read failure here (not just theoretical: disk
        // I/O error, lock contention) would otherwise hang every single launch on
        // the splash screen forever with no error visible to the user. Defaulting
        // to "needs onboarding" is the safe failure direction — re-showing
        // onboarding is a minor annoyance, silently skipping it for a genuinely new
        // user would not be.
        console.error('Failed to read onboarding_complete', error);
        setNeedsOnboarding(true);
      });
  }, [db]);

  // expo-router's own initial-route resolution isn't reliable enough to trust here —
  // verified live on a genuinely fresh install (no onboarding_complete flag in the
  // database at all) that it opened straight to (tabs) regardless of what Stack's
  // initialRouteName said. Forcing the right route explicitly, and only calling
  // onReady() (which hides the native splash in the parent) once the pathname actually
  // confirms we've landed on it, means the splash stays up through however many
  // renders the correction takes — the user never sees whatever expo-router shows
  // internally in between, regardless of why it picked that in the first place.
  useEffect(() => {
    if (needsOnboarding === null || settledRef.current) return;
    const target = needsOnboarding ? '/onboarding' : '/';
    if (pathname === target) {
      settledRef.current = true;
      onReady();
    } else {
      router.replace(target);
    }
  }, [needsOnboarding, pathname, onReady]);

  // "Sync whenever it connects to the internet" without a native background-fetch
  // module (which needs a dev build we don't have working yet — see the reminders/
  // notifications setup) means catching every point this app actually runs: cold
  // launch, and whenever it's brought back to the foreground. A quarter rarely
  // changes, so this is cheap — it no-ops instantly once the current quarter is
  // already downloaded. True OS-driven background sync (while the app is fully
  // closed) can be added later via expo-background-fetch once a dev build exists.
  useEffect(() => {
    let syncing = false;
    const trySync = () => {
      const now = Date.now();
      // The 60s window only guards against rapid foreground flapping — it does nothing
      // if a single sync (up to 2 languages x 2 quarters, each fetched day-by-day) is
      // still genuinely in flight past that window on a slow connection, which would
      // otherwise let a second overlapping sync start writing the same quarters at once.
      if (syncing || now - lastAttempt.current < 60_000) return;
      lastAttempt.current = now;
      syncing = true;
      syncSabbathSchool(db)
        .then(() => refreshSabbathSchoolReminder(db))
        .catch(() => {})
        .finally(() => {
          syncing = false;
        });
    };
    trySync();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') trySync();
    });
    return () => sub.remove();
  }, [db]);

  return (
    <>
      {/* Icon color must invert with the theme — dark icons render invisible on this app's
          dark surfaces/headers, which is why the status bar (clock/battery/signal) was
          disappearing. "auto" doesn't work here since it means "invert display's own color",
          not "match app theme". */}
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <NavigationThemeProvider value={navTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </NavigationThemeProvider>
      <AppAlertHost />
    </>
  );
}
