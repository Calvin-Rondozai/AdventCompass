import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// The source PNG's actual pixel dimensions (see the crop step that produced it) — needed
// to compute an explicit height from a fixed width below.
const MARK_ASPECT_RATIO = 900 / 480;

// Loosely mirrors app.json's expo-splash-screen `imageWidth` — the native OS-level splash
// icon (android/app/src/main/res/values/styles.xml + the generated drawable-*dpi/
// splashscreen_logo.png files) is a square canvas with the actual logo scaled down and
// centered well inside it (assets/splash-mark-square.png, ~55% of the canvas width) so
// Android's own icon-container sizing/masking can't crop any of it — see
// scripts/make_splash_icon_square.py. Because Android ultimately decides the final
// on-screen icon container size itself (not something this app controls precisely), this
// constant is a best-effort reference point rather than a guaranteed exact match.
const NATIVE_SPLASH_MARK_WIDTH = 280;

// This component's own version of the mark is shown deliberately a bit larger than the
// native splash icon it hands off from, once it's had a beat to establish continuity.
const MARK_WIDTH = NATIVE_SPLASH_MARK_WIDTH * 1.15;

// Must match app.json's expo-splash-screen `backgroundColor` and the PNG's own baked-in
// background exactly — this is what makes swapping from the native OS splash to this
// JS one (see app/_layout.tsx) imperceptible instead of a visible flash/color-jump.
const SPLASH_BACKGROUND = '#25516C';

// Android 12+'s native SplashScreen API only supports a small icon + background color —
// it can't show the wordmark or tagline as part of the OS-level splash. This component is
// the properly laid-out branded splash: the same logo (app.json's expo-splash-screen
// `image`, at NATIVE_SPLASH_MARK_WIDTH) but rendered here a bit bigger (MARK_WIDTH), plus
// the tagline the native icon-only slot can never show, shown as a full-bleed overlay the
// instant the native splash is dismissed underneath it (same background color either side,
// so the handoff is imperceptible).
//
// The logo + "AdventCompass" wordmark (assets/splash-mark.png) stay as one flat image —
// baked in at generation time, see the note in feedback_splash_asset_generation memory
// for why (real fonts via Python+Pillow, not reproduced live here). The "Powered by
// Hello C" tagline used to be baked into that same image too, but a flat image can't be
// independently repositioned — the tagline is now a plain <Text> pinned to the actual
// bottom of the screen via safe-area insets, decoupled from wherever the mark image
// itself happens to end. Deliberately the platform default font (not Lora/Raleway,
// this app's loaded custom fonts) — this renders before fontsLoaded resolves (see
// app/_layout.tsx), and the system font is always available with no loading race.
export function BrandedSplash() {
  const insets = useSafeAreaInsets();
  const markHeight = MARK_WIDTH / MARK_ASPECT_RATIO;

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]}>
      <Image
        source={require('@/assets/splash-mark.png')}
        style={{ width: MARK_WIDTH, height: markHeight }}
        resizeMode="contain"
      />
      <Text style={[styles.tagline, { bottom: insets.bottom + 32 }]}>Powered by Hello C</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SPLASH_BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: {
    position: 'absolute',
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
  },
});
