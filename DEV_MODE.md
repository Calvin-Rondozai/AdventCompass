# Dev Mode

Developer-facing map of AdventCompass: stack, feature-to-file table, content sourcing/
licensing notes, and known constraints. See `README.md` for the project overview.

This file is kept up to date as features are added — treat it as the map of what
exists and where, not a changelog of every edit.

## Stack

- Expo Router (file-based routing) — see `app/(tabs)/`
- expo-sqlite for all persistent data (no AsyncStorage) — schema in `database/schema.ts`,
  migrations in `database/migrate.ts` (self-healing: checks actual table shape, not just
  `PRAGMA user_version`, since hot-reload during development can desync the two)
- Theme system: `theme/ThemeProvider.tsx` (light/dark/system, persisted via a `app_kv`
  key-value table)
- Icons: `components/ui/Icon.tsx` wraps Ionicons (`@expo/vector-icons`) behind the same
  component names lucide-react-native used to export, so call sites didn't need to
  change when the icon set was swapped. Two icons (`HeartHandshake`, `NotebookPen`) are
  intentionally still lucide, by request.

## Features and where they live

| Feature | Routes | Data |
|---|---|---|
| Bible (5 translations, offline) | `app/(tabs)/bible/` | `database/bible.ts`, `database/bibleFull.*.json` |
| Cross-references | verse `Link2` icon in chapter reader | `database/crossReferences.ts` (openbible.info, CC BY) |
| Bible Commentary (S.D.A. Bible Commentary, vols. 1-6) | `app/(tabs)/more/commentary*` | `database/sdaCommentary.ts` |
| Ellen G. White books (~40 titles) | `app/(tabs)/more/egw*` | `database/egwBooks.ts` |
| Hymnal (English/chiShona/isiNdebele) | `app/(tabs)/hymnal*` | `database/hymnal.ts` |
| Fundamental Beliefs (28) | `app/(tabs)/more/beliefs*` | `database/fundamentalBeliefs.ts` |
| Sabbath School lessons (auto-synced; English/chiShona, standard/Easy Reading) | `app/(tabs)/more/sabbath-school*` | `database/sabbathSchool.ts`, `services/sabbathSchoolSync.ts` |
| Devotionals | `app/(tabs)/more/devotional.tsx` | `database/devotionals.ts` |
| Offertory readings | `app/(tabs)/more/offertory.tsx` | `database/offertory.ts` |
| Reading plans (preset + custom) | `app/(tabs)/more/reading-plans*` | `database/customReadingPlans.ts` |
| Notes (checklists, per-note reminders, iOS-Notes-style list) | `app/(tabs)/notes/` | `database/notes.ts` |
| Prayer requests | `app/(tabs)/prayer/` | schema: `prayer` table |
| Health & Wellness (water in cups, exercise) | `app/(tabs)/more/health.tsx` + dashboard | `database/habits.ts`, `database/wellnessGoals.ts` |
| Reminders/notifications | `app/(tabs)/more/notifications.tsx` | `database/reminders.ts`, `services/notifications.ts` |
| Topical Verses (anxiety, grief, joy, etc.) | `app/(tabs)/more/topical-verses*` | `database/topicalVerses.ts` |
| Children's Sermons (~30 object lessons) | `app/(tabs)/more/childrens-sermons*` | `database/childrensSermons.ts` |
| AI Bible Assistant (offline, on-device LLM — in progress) | `app/(tabs)/more/ai-assistant.tsx` | `services/aiModel.ts` |

## Content sourcing and licensing notes

- **Bible translations**: NHEB, KJV, ASV, MKJV (public domain/permissive), SNA (Shona,
  CC BY-SA 4.0, eBible.org). NKJV was requested but is copyrighted — MKJV was used
  instead by explicit agreement.
- **Hymnals**: sourced from the local Cis Android app's bundled data (Apache 2.0
  compilation) for English/Shona/Ndebele SDA hymnals.
- **Ellen G. White books**: the ellenwhite.info-hosted titles are public domain
  (published before 1929). Several more were parsed directly from PDFs in the user's own
  library — same personal-use basis as the rest of this app's content.
- **S.D.A. Bible Commentary**: parsed from the user's own PDF library (organized by
  Bible book → chapter → verse; volume 7A is a topical appendix, not verse commentary).
- **Cross-references**: openbible.info dataset, CC BY.
- **Sabbath School lessons**: the official app (Adventech, for the GC Sabbath School &
  Personal Ministries department) has no public API. Content is pulled from
  `github.com/Adventech/sabbath-school-lessons` (raw markdown/YAML, no auth needed) —
  **the lesson text itself carries a General Conference copyright notice requiring
  written authorization for reproduction**, separate from that repo's MIT license. This
  app only caches it locally for the app owner's own offline reading; that restriction
  should be kept in mind if this app is ever distributed beyond personal use.
- **Fundamental Beliefs**: parsed from the GC's own 28 Fundamental Beliefs PDF (2015
  edition), in the user's library.
- **Children's Sermons**: sourced from Haverhill SDA Church's public children's-sermon
  archive (`haverhillma.adventistchurch.org`) — a real Adventist congregation's own
  material, not a GC-blanket resource. The site itself says the notes are free to use and
  modify, but there's no formal license grant (single author/congregation, not an org-wide
  policy), so this app treats it the same personal-offline-use-only basis as the other
  externally-sourced content here, not as freely redistributable. Attribution kept in the
  in-app description text.

## Known constraints

- **Notifications require a dev/standalone build.** Expo Go on Android (SDK 53+)
  crashes on merely importing `expo-notifications` — every reminder-related module
  guards on `Constants.executionEnvironment !== ExecutionEnvironment.StoreClient` and
  no-ops in Expo Go. A dev-client build (`npx expo run:android`) has been attempted
  repeatedly and keeps failing on flaky network (DNS/TLS resets against Google's Maven
  mirrors) — this is an environment issue, not a code issue. Retry when network is
  stable.
- **Sabbath School auto-sync** runs on app launch and on returning to the foreground
  (debounced to once a minute), not via a true OS-level background-fetch — that would
  need `expo-background-fetch` + `expo-task-manager`, which are native modules requiring
  the same currently-blocked dev build. This is the reliable option available today; the
  native version can be added once a dev build exists.
- **AI Bible Assistant**: intentionally not implemented yet — explicitly deferred until
  the app owner asks for it.
- **Lazy loading discipline**: every large JSON dataset (Bible translations, hymnals,
  EGW books, commentary volumes) is `require()`'d inside a function, not at module top
  level, and cached in a module-level map after first load. This is the main performance
  lever in the app — don't reintroduce a top-level `import` of a large JSON file.
