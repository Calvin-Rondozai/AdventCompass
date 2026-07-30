import type * as SpeechModule from 'expo-speech';

// Shared by hooks/useReadAloud.ts and components/reader/VoiceSettingsSheet.tsx so
// both ever touch expo-speech's native module through the same lazy require() and
// the same cached voice list, rather than each keeping its own copy of either.
//
// Deferred require(), never a static top-level import: expo-speech should only be
// touched once the user shows real intent to use Read Aloud (opening the read-aloud
// bar or its settings), not on every one of the four reader screens' visits — same
// class of fix as services/llm.ts (llama.rn) and services/notifications.ts
// (expo-notifications) already apply to their own native modules.
let Speech: typeof SpeechModule | null = null;
export function getSpeech(): typeof SpeechModule {
  if (!Speech) Speech = require('expo-speech');
  return Speech!;
}

let voicesCache: SpeechModule.Voice[] | null = null;
let voicesPromise: Promise<SpeechModule.Voice[]> | null = null;

// Installed voices are a property of the device, not of any one screen or session
// action — fetch once and reuse everywhere. Without this, every single open of the
// Voice Settings sheet (even the second, even from a different reader screen)
// re-ran the native enumeration call and sat on "loading" again, when the answer
// hadn't changed since the first time.
export function getCachedVoices(): SpeechModule.Voice[] | null {
  return voicesCache;
}

// Safe to call speculatively (e.g. the moment the read-aloud bar opens, well before
// the user reaches the settings gear) — resolves instantly from cache once the first
// call has completed, and multiple concurrent calls before then share one in-flight
// request rather than firing the native call twice.
export function prefetchVoices(): Promise<SpeechModule.Voice[]> {
  if (voicesCache) return Promise.resolve(voicesCache);
  if (!voicesPromise) {
    voicesPromise = getSpeech()
      .getAvailableVoicesAsync()
      .then((list) => {
        voicesCache = list;
        return list;
      })
      .catch((err) => {
        voicesPromise = null;
        throw err;
      });
  }
  return voicesPromise;
}
