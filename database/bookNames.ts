import shonaBookNames from './shonaBookNames.json';

const BOOK_NAME_OVERRIDES: Record<string, Record<string, string>> = {
  SNA: shonaBookNames,
};

export function getLocalizedBookName(translation: string, englishName: string): string {
  return BOOK_NAME_OVERRIDES[translation]?.[englishName] ?? englishName;
}

// Only the names long enough to wrap or crowd a grid/pill cell (roughly >10 characters)
// get shortened — everything else keeps its full name. Only applies to English; a
// translated name (see BOOK_NAME_OVERRIDES) is shown in full since there's no
// corresponding abbreviation for it.
const SHORT_ENGLISH_NAMES: Record<string, string> = {
  Deuteronomy: 'Deut.',
  '1 Chronicles': '1 Chron.',
  '2 Chronicles': '2 Chron.',
  Ecclesiastes: 'Eccles.',
  'Song of Solomon': 'Song of Sol.',
  Lamentations: 'Lam.',
  Philippians: 'Phil.',
  '1 Corinthians': '1 Cor.',
  '2 Corinthians': '2 Cor.',
  '1 Thessalonians': '1 Thess.',
  '2 Thessalonians': '2 Thess.',
};

export function getShortBookName(translation: string, englishName: string): string {
  if (BOOK_NAME_OVERRIDES[translation]?.[englishName]) return BOOK_NAME_OVERRIDES[translation][englishName];
  return SHORT_ENGLISH_NAMES[englishName] ?? englishName;
}
