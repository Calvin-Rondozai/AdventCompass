export type Hymn = { number: number; title: string; lyrics: string };
export type HymnalLanguage = 'english' | 'shona' | 'ndebele';

export type HymnalInfo = {
  code: HymnalLanguage;
  label: string;
  source: string;
};

export const HYMNALS: HymnalInfo[] = [
  { code: 'english', label: 'English', source: 'Christ in Song' },
  { code: 'shona', label: 'chiShona', source: 'Kristu MuNzwiyo' },
  { code: 'ndebele', label: 'isiNdebele', source: 'UKrestu Esihlabelelweni' },
];

// Remembers which hymnal language the landing screen (app/(tabs)/hymnal/index.tsx,
// which just redirects to it) should open by default.
export const HYMNAL_LAST_LANGUAGE_KEY = 'hymnal_last_language';

// Each hymnal is loaded lazily on first access (rather than as a top-level import)
// so its JSON isn't parsed and held in memory unless the user actually opens it.
const HYMN_DATA: Partial<Record<HymnalLanguage, Hymn[]>> = {};

function loadHymns(language: HymnalLanguage): Hymn[] {
  if (!HYMN_DATA[language]) {
    // Metro requires string-literal require() paths — it cannot resolve a
    // dynamically-built path, hence the explicit branches instead of a lookup table.
    switch (language) {
      case 'english':
        HYMN_DATA.english = require('./hymnalEnglish.json');
        break;
      case 'shona':
        HYMN_DATA.shona = require('./hymnalShona.json');
        break;
      case 'ndebele':
        HYMN_DATA.ndebele = require('./hymnalNdebele.json');
        break;
    }
  }
  return HYMN_DATA[language]!;
}

export function getHymns(language: HymnalLanguage): Hymn[] {
  return loadHymns(language);
}

export function getHymn(language: HymnalLanguage, number: number): Hymn | undefined {
  return loadHymns(language).find((h) => h.number === number);
}

export function clearHymnCache(): void {
  for (const key of Object.keys(HYMN_DATA)) delete HYMN_DATA[key as HymnalLanguage];
}
