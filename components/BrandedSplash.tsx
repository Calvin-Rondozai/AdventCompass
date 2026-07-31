import React from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// The source PNG's actual pixel dimensions (see the crop step that produced it) —
// needed to compute an explicit height below, since a percentage width + aspectRatio
// combination on <Image> rendered the mark at close to its raw 900px intrinsic size
// instead of scaling it down (cropped edge-to-edge on both sides on a real device).
// Explicit pixel dimensions computed from actual screen width sidestep that entirely.
const MARK_ASPECT_RATIO = 900 / 480;

// Must match app.json's expo-splash-screen `backgroundColor` and the PNG's own baked-in
// background exactly — this is what makes swapping from the native OS splash to this
// JS one (see app/_layout.tsx) imperceptible instead of a visible flash/color-jump.
const SPLASH_BACKGROUND = '#25516C';

// Android 12+'s native SplashScreen API (see android/app/src/main/res/values/styles.xml)
// only supports a small icon + background color — it can't show the wordmark or
// tagline as part of the OS-level splash, no matter what image is fed into it. This
// component is the actual branded splash, rendered as a plain JS screen and shown as a
// full-bleed overlay while the native splash is dismissed immediately underneath it
// (same background color either side, so the handoff reads as one continuous screen).
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
  const { width: screenWidth } = useWindowDimensions();
  const markWidth = screenWidth * 0.7;
  const markHeight = markWidth / MARK_ASPECT_RATIO;

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]}>
      <Image
        source={require('@/assets/splash-mark.png')}
        style={{ width: markWidth, height: markHeight }}
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
