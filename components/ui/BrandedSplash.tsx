import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

// Native splash (expo-splash-screen) can only show a background color + one centered
// image — no text. This renders for a brief moment right after the native splash hides,
// matching its look exactly, so "Powered by Hello C" actually appears on screen instead
// of being technically impossible. Deliberately styled with plain RN Text/hardcoded
// colors (not theme.*) — it renders outside ThemeProvider and should look identical
// regardless of light/dark mode, like any other splash screen.
export function BrandedSplash() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.container]}>
      <Image source={require('@/assets/ico.png')} resizeMode="contain" style={styles.logo} />
      <Text style={styles.title}>
        <Text style={styles.titleAdvent}>Advent</Text>
        <Text style={styles.titleCompass}>Compass</Text>
      </Text>
      <Text style={styles.poweredBy}>Powered by Hello C</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#25516C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 160,
    height: 160,
  },
  title: {
    marginTop: 16,
    fontSize: 26,
    fontFamily: 'Lora_700Bold',
  },
  titleAdvent: {
    color: '#FFFFFF',
  },
  titleCompass: {
    color: '#D4AF37',
  },
  poweredBy: {
    position: 'absolute',
    bottom: 48,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontFamily: 'Raleway_400Regular',
  },
});
