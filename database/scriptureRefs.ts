// Maps the abbreviations EGW Writings commentary uses in cross-references (and the
// full names too, since some appear unabbreviated) to this app's canonical Bible book
// names in database/bibleBooks.ts.
const ABBREV_TO_BOOK: Record<string, string> = {
  gen: 'Genesis', genesis: 'Genesis',
  ex: 'Exodus', exod: 'Exodus', exodus: 'Exodus',
  lev: 'Leviticus', leviticus: 'Leviticus',
  num: 'Numbers', numbers: 'Numbers',
  deut: 'Deuteronomy', deuteronomy: 'Deuteronomy',
  josh: 'Joshua', joshua: 'Joshua',
  judg: 'Judges', judges: 'Judges',
  ruth: 'Ruth',
  '1 sam': '1 Samuel', '1 samuel': '1 Samuel',
  '2 sam': '2 Samuel', '2 samuel': '2 Samuel',
  '1 kings': '1 Kings', '2 kings': '2 Kings',
  '1 chron': '1 Chronicles', '1 chronicles': '1 Chronicles',
  '2 chron': '2 Chronicles', '2 chronicles': '2 Chronicles',
  ezra: 'Ezra',
  neh: 'Nehemiah', nehemiah: 'Nehemiah',
  esth: 'Esther', esther: 'Esther',
  job: 'Job',
  ps: 'Psalms', psalm: 'Psalms', psalms: 'Psalms', pss: 'Psalms',
  prov: 'Proverbs', proverbs: 'Proverbs',
  eccl: 'Ecclesiastes', ecclesiastes: 'Ecclesiastes',
  'song of solomon': 'Song of Solomon', 'song of songs': 'Song of Solomon', 'sol': 'Song of Solomon',
  isa: 'Isaiah', isaiah: 'Isaiah',
  jer: 'Jeremiah', jeremiah: 'Jeremiah',
  lam: 'Lamentations', lamentations: 'Lamentations',
  eze: 'Ezekiel', ezek: 'Ezekiel', ezekiel: 'Ezekiel',
  dan: 'Daniel', daniel: 'Daniel',
  hos: 'Hosea', hosea: 'Hosea',
  joel: 'Joel',
  amos: 'Amos',
  obad: 'Obadiah', obadiah: 'Obadiah',
  jonah: 'Jonah',
  micah: 'Micah', mic: 'Micah',
  nahum: 'Nahum', nah: 'Nahum',
  hab: 'Habakkuk', habakkuk: 'Habakkuk',
  zeph: 'Zephaniah', zephaniah: 'Zephaniah',
  hag: 'Haggai', haggai: 'Haggai',
  zech: 'Zechariah', zechariah: 'Zechariah',
  mal: 'Malachi', malachi: 'Malachi',
  matt: 'Matthew', matthew: 'Matthew',
  mark: 'Mark',
  luke: 'Luke',
  john: 'John',
  acts: 'Acts',
  rom: 'Romans', romans: 'Romans',
  '1 cor': '1 Corinthians', '1 corinthians': '1 Corinthians',
  '2 cor': '2 Corinthians', '2 corinthians': '2 Corinthians',
  gal: 'Galatians', galatians: 'Galatians',
  eph: 'Ephesians', ephesians: 'Ephesians',
  phil: 'Philippians', philippians: 'Philippians',
  col: 'Colossians', colossians: 'Colossians',
  '1 thess': '1 Thessalonians', '1 thessalonians': '1 Thessalonians',
  '2 thess': '2 Thessalonians', '2 thessalonians': '2 Thessalonians',
  '1 tim': '1 Timothy', '1 timothy': '1 Timothy',
  '2 tim': '2 Timothy', '2 timothy': '2 Timothy',
  titus: 'Titus',
  philem: 'Philemon', philemon: 'Philemon',
  heb: 'Hebrews', hebrews: 'Hebrews',
  james: 'James', jas: 'James',
  '1 peter': '1 Peter', '1 pet': '1 Peter',
  '2 peter': '2 Peter', '2 pet': '2 Peter',
  '1 john': '1 John',
  '2 john': '2 John',
  '3 john': '3 John',
  jude: 'Jude',
  rev: 'Revelation', revelation: 'Revelation',
};

const BOOK_NAME_PATTERN =
  '(?:[1-3]\\s?(?:Sam(?:uel)?|Kings|Chron(?:icles)?|Cor(?:inthians)?|Thess(?:alonians)?|Tim(?:othy)?|John|Peter|Pet)|' +
  'Gen(?:esis)?|Ex(?:od(?:us)?)?|Lev(?:iticus)?|Num(?:bers)?|Deut(?:eronomy)?|Josh(?:ua)?|Judg(?:es)?|Ruth|' +
  'Ezra|Neh(?:emiah)?|Esth(?:er)?|Job|Ps(?:alms?)?|Pss|Prov(?:erbs)?|Eccl(?:esiastes)?|' +
  'Song of Solomon|Song of Songs|Isa(?:iah)?|Jer(?:emiah)?|Lam(?:entations)?|Eze(?:k(?:iel)?)?|Dan(?:iel)?|' +
  'Hos(?:ea)?|Joel|Amos|Obad(?:iah)?|Jonah|Mic(?:ah)?|Nah(?:um)?|Hab(?:akkuk)?|Zeph(?:aniah)?|Hag(?:gai)?|' +
  'Zech(?:ariah)?|Mal(?:achi)?|Matt(?:hew)?|Mark|Luke|John|Acts|Rom(?:ans)?|Gal(?:atians)?|Eph(?:esians)?|' +
  'Phil(?:ippians)?|Col(?:ossians)?|Titus|Philem(?:on)?|Heb(?:rews)?|James|Jas|Jude|Rev(?:elation)?)';

// Range dashes in published lesson text are typographic ("Acts 17:16–34" uses an en dash,
// not a hyphen) — accept hyphen, en dash, and em dash so a verse range's end isn't silently
// dropped, which would otherwise leave the reference pointing at only its first verse.
const REF_REGEX = new RegExp(`\\b(${BOOK_NAME_PATTERN})\\.?\\s+(\\d{1,3}):(\\d{1,3})(?:[-–—](\\d{1,3}))?(?:,\\s?\\d{1,3})*`, 'gi');

export type ScriptureRefMatch = {
  text: string;
  start: number;
  end: number;
  book: string;
  chapter: number;
  verse: number;
  verseEnd?: number;
};

export function findScriptureRefs(text: string): ScriptureRefMatch[] {
  const matches: ScriptureRefMatch[] = [];
  REF_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = REF_REGEX.exec(text))) {
    const key = m[1].toLowerCase().replace(/\.$/, '').replace(/\s+/g, ' ').trim();
    const book = ABBREV_TO_BOOK[key];
    if (!book) continue;
    matches.push({
      text: m[0],
      start: m.index,
      end: m.index + m[0].length,
      book,
      chapter: Number(m[2]),
      verse: Number(m[3]),
      verseEnd: m[4] ? Number(m[4]) : undefined,
    });
  }
  return matches;
}
