export type TranslationInfo = {
  code: string;
  name: string;
  language: string;
  license: string;
};

export const BIBLE_TRANSLATIONS: TranslationInfo[] = [
  { code: 'NHEB', name: 'New Heart English Bible', language: 'English', license: 'Public domain' },
  { code: 'KJV', name: 'King James Version (1769)', language: 'English', license: 'Public domain' },
  { code: 'ASV', name: 'American Standard Version (1901)', language: 'English', license: 'Public domain' },
  { code: 'MKJV', name: "Green's Modern King James Version", language: 'English', license: 'Public domain' },
  {
    code: 'SNA',
    name: 'Bhaibheri Dzvene Rakasununguka (Shona Contemporary Bible, 2017)',
    language: 'chiShona',
    license: 'Biblica, Inc., CC BY-SA 4.0',
  },
];

export const DEFAULT_TRANSLATION = 'NHEB';
