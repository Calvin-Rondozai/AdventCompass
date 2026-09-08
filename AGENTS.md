# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# WORK IN PROGRESS — read this first if resuming a session

(Delete this section once the release APK is verified on-device. It exists purely so a fresh
session in this folder knows where things stand. Sizing techniques below are still in place and
still working — but see the size history note: the 103.6MB/76.2MB figure is stale, a lot of real
feature work has landed since it was measured. Don't start a new shrink pass unless asked.)

**Original ask:** build a release APK, shrink it toward ~100MB, and fix: background/exact-time
notifications, a Friday-5pm-to-Saturday-sunset Sabbath greeting, janky/stuck navigation, a tab
bar that flicks on "more options" taps, and an invisible status bar.

**Done:**
- `android/gradle.properties` + `android/app/build.gradle`: dropped x86/x86_64 (emulator-only)
  and enabled per-ABI APK splits (`armeabi-v7a`, `arm64-v8a`) instead of one universal APK.
- `android/app/build.gradle`: excluded 5 of llama.rn's 7 redundant CPU-variant `.so` files
  (kept baseline + `dotprod`) — its Java loader already falls back gracefully.
- `android/app/src/main/AndroidManifest.xml`: added `SCHEDULE_EXACT_ALARM`,
  `RECEIVE_BOOT_COMPLETED`, `POST_NOTIFICATIONS` permissions.
- `services/notifications.ts`: `ensureNotificationSetup(db)` now also deep-links to the Android
  exact-alarm settings screen once (`ensureExactAlarmsEnabled`) — signature changed, call sites
  in `app/(tabs)/notes/[id].tsx` and `app/(tabs)/more/notifications.tsx` updated to pass `db`.
- `utils/greeting.ts` + new `hooks/useSabbathGreeting.ts` + new `utils/sunset.ts`: Friday is a
  fixed 00:00–17:00 "Happy Preparation Day" / 17:00–24:00 "Happy Sabbath" cutover; Saturday uses
  a real astronomical sunset (ported SunCalc algorithm) computed from GPS location
  (`expo-location`, newly installed + added to `app.json` plugins) cached in `app_kv`. Wired
  into `app/(tabs)/index.tsx` (was a plain `getGreeting()` call).
- `app/(tabs)/_layout.tsx` / `app/(tabs)/more/_layout.tsx`: the bottom tab bar's hide-for-More
  logic was round-tripping through a Context + useEffect one render behind the actual
  navigation, causing a visible "flick". Now computed synchronously from `usePathname()` in the
  same render as the nav change; the More-layout effect was deleted entirely.
- `components/bible/VersePopup.tsx` / `TranslationSheet.tsx`: replaced RN `<Modal>` (opens a
  separate Android Window — closing it redraws the host window, which is the other flick
  source) with a plain absolutely-positioned overlay + `BackHandler` for the hardware back
  button. **Note:** other files still use `<Modal>` (`more/notifications.tsx`, `notes/[id].tsx`,
  `more/sabbath-school.tsx`, `bible/[book]/[chapter].tsx`, `HymnNumberJump.tsx`,
  `notes/index.tsx`, `AppAlert.tsx`, `more/health.tsx`) — not touched, only flagged as a
  possible follow-up if flicker is still seen elsewhere.
- `app/_layout.tsx`: added `<StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />` —
  was never configured before, hence invisible icons.
- **Biggest size win:** `database/*.json` for the 5 full Bible translations and all 49 EGW
  books were `require()`'d directly, so Metro baked their full ~59MB of raw text straight into
  `assets/index.android.bundle` (measured at 77MB, uncompressed-in-APK). Renamed all 54 files
  to `.datjson`, registered that extension in `metro.config.js` (`resolver.assetExts`) so Metro
  treats them as opaque bundled assets instead of inlined JS, and added `database/loadJsonAsset.ts`
  (Asset.fromModule + expo-file-system read + JSON.parse) to load them on demand. This made
  `loadFullBible`/`getEgwBook`/`getEgwChapter` async — call sites updated in
  `app/(tabs)/more/egw/[code].tsx`, `app/(tabs)/more/egw/[code]/[number].tsx` (this one had a
  `setTimeout` hack working around the old synchronous parse — removed, genuinely async now),
  and `database/searchIndex.ts`. **Not converted** (small enough not to matter):
  `crossReferences.json` (2.8MB), `hymnal*.json` (~580KB), `sdaCommentary*.json` (~1.3MB),
  `childrensSermonsData.json` (92KB), `fundamentalBeliefs.json` (28KB), `shonaBookNames.json` (4KB).

**Size history** (arm64-v8a / armeabi-v7a release APKs):
- Original universal APK (4 ABIs): 279MB
- After ABI split + drop x86/x86_64: 194MB / 118MB
- After llama.rn variant trim + Bible/EGW JSON moved out of the JS bundle: 103.6MB / 76.2MB
  (measured at commit 81e83b4 — user explicitly chose to stop here rather than push further,
  e.g. dropping the AI engine's universal fallback variant, or enabling untested R8 minification)
- **2026-09-07, current HEAD (439 files changed since 81e83b4 — widgets, hymn audio, hymn sheet
  music, notifications, Sabbath PDF sync, speech engine, etc.): 128.9MB / 102.9MB.** The
  techniques above are all still applied and still working as configured — this is organic growth
  from real feature work, not a regression. Don't treat 103.6/76.2 as the current baseline; if
  shrinking is wanted again, re-measure from here first (e.g. is minifyEnabled/shrinkResources
  actually on? check `enableMinifyInReleaseBuilds`/`android.enableShrinkResourcesInReleaseBuilds`
  in gradle.properties).

**Not yet done / never confirmed:**
- The rebuilt/resized APK (either measurement above) has not been installed and smoke-tested on a
  real device or emulator.
- Notifications' exact-alarm settings redirect (`Linking.sendIntent`) has not been verified to
  actually open the right screen on a real device.
- The Sabbath greeting's GPS sunset calculation has not been verified against a real location.

**Build environment gotcha (cost real time this session):** never run `gradlew`/`gradlew.bat`
from Git Bash — it sets `MSYSTEM=MINGW64`, which breaks CMake's Android NDK toolchain detection
("CMAKE_RC_COMPILER not set"). Always build via the PowerShell tool instead. Also: PowerShell's
default log redirection (`*>`) writes UTF-16LE — pipe through `iconv -f UTF-16LE -t UTF-8` before
grepping a redirected log file from Bash.
