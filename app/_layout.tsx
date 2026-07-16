import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, LogBox } from 'react-native';
import { router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getKv } from '@/database/kv';
import { BrandedSplash } from '@/components/ui/BrandedSplash';

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
// Registers the foreground notification handler on every launch — reminders are
// scheduled with the OS and survive restarts, but this in-memory handler config
// (how a notification behaves while the app is open) must be set up each session.
import '@/services/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

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
  const [showBrandedSplash, setShowBrandedSplash] = useState(true);

  useEffect(() => {
    if (fontsLoaded && dbReady) {
      SplashScreen.hideAsync()
        .catch(() => {})
        .then(() => {
          // Native splash can't show text — hold our own matching screen (with "Powered
          // by Hello C") up for a beat right as it hides, then reveal the real app.
          setTimeout(() => setShowBrandedSplash(false), 700);
        });
    }
  }, [fontsLoaded, dbReady]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
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
      </SafeAreaProvider>
      {showBrandedSplash && <BrandedSplash />}
    </GestureHandlerRootView>
  );
}

function RootReady({ onReady }: { onReady: () => void }) {
  const db = useSQLiteContext();
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

  useEffect(() => {
    getKv(db, 'onboarding_complete').then((v) => {
      setNeedsOnboarding(v !== '1');
    });
  }, [db]);

  // expo-router's own initial-route resolution isn't reliable enough to trust here —
  // verified live on a genuinely fresh install (no onboarding_complete flag in the
  // database at all) that it opened straight to (tabs) regardless of what Stack's
  // initialRouteName said. Forcing the right route explicitly, and only calling
  // onReady() (which hides BrandedSplash in the parent) once the pathname actually
  // confirms we've landed on it, means BrandedSplash stays up through however many
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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <AppAlertHost />
    </>
  );
}
