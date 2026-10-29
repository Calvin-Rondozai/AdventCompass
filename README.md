# AdventCompass

![platform](https://img.shields.io/badge/platform-Android%20%7C%20iOS-blue)
![expo](https://img.shields.io/badge/Expo-SDK%2057-000020?logo=expo)
![offline](https://img.shields.io/badge/offline--first-yes-brightgreen)

An offline-first companion app for Seventh-day Adventists — Bible, hymnal, Ellen G.
White's writings, Bible commentary, Sabbath School lessons, devotionals, prayer, notes,
an on-device AI assistant, and health tracking, all in one place, all available
without a connection.

## Features

- **Bible** — five translations, cross-references, side-by-side comparison, verse
  highlighting, copy/share, bookmarks, search, and Read Aloud narration
- **Bible Commentary** — S.D.A. Bible Commentary, volumes 1–6, linked verse-by-verse
  to the Bible reader
- **AI Bible Assistant ("Hello C")** — answers from the Bible, all 49 EGW books,
  commentary, and hymns already in the app; runs fully offline after a one-time
  ~800MB model download, or online for instant answers without the download
- **Ellen G. White library** — all 49 books, searchable, with page numbers,
  highlighting, and Read Aloud narration
- **Hymnal** — English, chiShona, isiNdebele, with audio playback, sheet music,
  favorites, and a quick jump-to-number dial
- **Sabbath School** — current quarter's lesson, auto-downloaded when you're online,
  with PDF sync; English or chiShona, standard or Easy Reading Edition
- **Bible reading plans**, **Fundamental Beliefs**, **topical verses**,
  **devotionals**, **children's sermons**, **special days**, and offertory readings
  with verse-tailored commentary
- **Prayer journal** and a **Notes** app with categories, pinning, archive, and
  grid/list views
- **Health & habit tracking** — Bible study, prayer, water intake, and exercise,
  with home screen widgets (water tank, weekly progress)
- **Sabbath greeting** — a Friday-5pm-to-Saturday-sunset greeting, timed to your
  actual location's sunset
- Background and exact-time reminders for prayer, water, Bible study, Sabbath prep,
  chapter-a-day reading, and more — all individually controllable from Settings

## Getting started

```bash
npm install
npx expo start
```

Requires a dev client for notifications (`npx expo run:android` / `run:ios`) — Expo
Go alone covers everything else.

## Content

Bible translations, the EGW library, and the Fundamental Beliefs are public-domain or
used under a permissive license. Sabbath School lessons are synced from
[Adventech/sabbath-school-lessons](https://github.com/Adventech/sabbath-school-lessons)
for personal offline reading; the lesson text itself remains under the General
Conference's copyright. See `DEV_MODE.md` for the full sourcing and licensing
breakdown, plus the technical map of the codebase.

## Legal

- [Terms of Use](https://calvin-rondozai.github.io/AdventCompass/terms.html)
- [Privacy Policy](https://calvin-rondozai.github.io/AdventCompass/privacy.html)

## License

Personal-use project. Bundled third-party content retains its own license — see
`DEV_MODE.md`.

## Legal
https://calvin-rondozai.github.io/AdventCompass/terms.html
https://calvin-rondozai.github.io/AdventCompass/privacy.html
