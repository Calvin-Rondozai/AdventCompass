import type { SQLiteDatabase } from 'expo-sqlite';
import { loadJsonAsset } from './loadJsonAsset';

export type EgwChapter = { number: number; title: string; content: string };
export type EgwBook = { code: string; title: string; author: string; chapters: EgwChapter[] };

export const EGW_BOOK_LIST: { code: string; title: string }[] = [
  { code: 'sc', title: 'Steps to Christ' },
  { code: 'pp', title: 'Patriarchs and Prophets' },
  { code: 'pk', title: 'Prophets and Kings' },
  { code: 'da', title: 'The Desire of Ages' },
  { code: 'aa', title: 'The Acts of the Apostles' },
  { code: 'gc', title: 'The Great Controversy' },
  { code: 'col', title: "Christ's Object Lessons" },
  { code: 'mb', title: 'Thoughts From the Mount of Blessing' },
  { code: 'mh', title: 'The Ministry of Healing' },
  { code: 'ed', title: 'Education' },
  { code: 'ew', title: 'Early Writings' },
  { code: 'sl', title: 'The Sanctified Life' },
  { code: 'slp', title: 'Sketches From the Life of Paul' },
  { code: 'ls', title: 'Life Sketches of Ellen G. White' },
  { code: 't1', title: 'Testimonies for the Church, vol. 1' },
  { code: 't2', title: 'Testimonies for the Church, vol. 2' },
  { code: 't3', title: 'Testimonies for the Church, vol. 3' },
  { code: 't4', title: 'Testimonies for the Church, vol. 4' },
  { code: 't5', title: 'Testimonies for the Church, vol. 5' },
  { code: 't6', title: 'Testimonies for the Church, vol. 6' },
  { code: 't7', title: 'Testimonies for the Church, vol. 7' },
  { code: 't8', title: 'Testimonies for the Church, vol. 8' },
  { code: 't9', title: 'Testimonies for the Church, vol. 9' },
  { code: 'adventhome', title: 'The Adventist Home' },
  { code: 'cet', title: 'Christian Experience and Teachings of Ellen G. White' },
  { code: 'cthbh', title: 'Christian Temperance and Bible Hygiene' },
  { code: 'darkness', title: 'Darkness Before Dawn' },
  { code: 'diet', title: 'Counsels on Diet and Foods' },
  { code: 'heavenlove', title: 'From Heaven With Love' },
  { code: 'lsjw', title: 'Life Sketches of James White and Ellen G. White (1888)' },
  { code: 'mcp1', title: 'Mind, Character, and Personality, vol. 1' },
  { code: 'mcp2', title: 'Mind, Character, and Personality, vol. 2' },
  { code: 'mtyp', title: 'Messages to Young People' },
  { code: 'prayer', title: 'Prayer' },
  { code: 'sg1', title: 'Spiritual Gifts, Volume 1' },
  { code: 'sg2', title: 'Spiritual Gifts, Volume 2' },
  { code: 'sg3', title: 'Spiritual Gifts, Volume 3' },
  { code: 'sg4', title: 'Spiritual Gifts, Volume 4A' },
  { code: 'sm3', title: 'Selected Messages, Book 3' },
  { code: 'solemnappeal', title: 'A Solemn Appeal' },
  { code: 'ste', title: 'Special Testimonies on Education' },
  { code: 'temperance', title: 'Temperance' },
  { code: 'truerevival', title: "True Revival: The Church's Greatest Need" },
  { code: 'tsbad', title: 'Testimonies on Sexual Behavior, Adultery, and Divorce' },
  { code: 'tssw', title: 'Testimonies on Sabbath-School Work' },
  { code: 'voicesong', title: 'The Voice in Speech and Song' },
  { code: 'cptns', title: 'Counsels to Parents, Teachers, and Students' },
  { code: 'evangelism', title: 'Evangelism' },
  { code: 'sdabc7a', title: 'S.D.A. Bible Commentary, vol. 7A (Appendix)' },
];

// Each book is its own .datjson file (some are large) — only read once, by
// loadEgwBooksIfNeeded below, to seed the egw_chapters table. See metro.config.js /
// loadJsonAsset.ts for why these are bundled assets rather than plain JSON requires.
const BOOK_MODULES: Record<string, number> = {
  sc: require('./egwSc.datjson'),
  pp: require('./egwPp.datjson'),
  pk: require('./egwPk.datjson'),
  da: require('./egwDa.datjson'),
  aa: require('./egwAa.datjson'),
  gc: require('./egwGc.datjson'),
  col: require('./egwCol.datjson'),
  mb: require('./egwMb.datjson'),
  mh: require('./egwMh.datjson'),
  ed: require('./egwEd.datjson'),
  ew: require('./egwEw.datjson'),
  sl: require('./egwSl.datjson'),
  slp: require('./egwSlp.datjson'),
  ls: require('./egwLs.datjson'),
  t1: require('./egwT1.datjson'),
  t2: require('./egwT2.datjson'),
  t3: require('./egwT3.datjson'),
  t4: require('./egwT4.datjson'),
  t5: require('./egwT5.datjson'),
  t6: require('./egwT6.datjson'),
  t7: require('./egwT7.datjson'),
  t8: require('./egwT8.datjson'),
  t9: require('./egwT9.datjson'),
  adventhome: require('./egwAdventHome.datjson'),
  cet: require('./egwCet.datjson'),
  cthbh: require('./egwCthbh.datjson'),
  darkness: require('./egwDarkness.datjson'),
  diet: require('./egwDiet.datjson'),
  heavenlove: require('./egwHeavenLove.datjson'),
  lsjw: require('./egwLsjw.datjson'),
  mcp1: require('./egwMcp1.datjson'),
  mcp2: require('./egwMcp2.datjson'),
  mtyp: require('./egwMtyp.datjson'),
  prayer: require('./egwPrayer.datjson'),
  sg1: require('./egwSg1.datjson'),
  sg2: require('./egwSg2.datjson'),
  sg3: require('./egwSg3.datjson'),
  sg4: require('./egwSg4.datjson'),
  sm3: require('./egwSm3.datjson'),
  solemnappeal: require('./egwSolemnAppeal.datjson'),
  ste: require('./egwSte.datjson'),
  temperance: require('./egwTemperance.datjson'),
  truerevival: require('./egwTrueRevival.datjson'),
  tsbad: require('./egwTsbad.datjson'),
  tssw: require('./egwTssw.datjson'),
  voicesong: require('./egwVoiceSong.datjson'),
  cptns: require('./egwCptns.datjson'),
  evangelism: require('./egwEvangelism.datjson'),
  sdabc7a: require('./egwSdabc7a.datjson'),
};

// One-time migration: copies every book out of its .datjson asset and into the
// egw_chapters table, the same pattern loadFullBible.ts uses for Bible translations.
// Reading straight from SQLite from then on is both faster (no per-open asset copy +
// megabyte-scale JSON.parse) and more reliable — the .datjson/expo-asset path had no
// error recovery and could leave a book stuck "loading" forever if a single read failed.
const INSERT_BATCH_SIZE = 50;

export async function loadEgwBooksIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) as n FROM egw_chapters');
  if ((row?.n ?? 0) > 0) return;

  await db.withTransactionAsync(async () => {
    for (const { code, title } of EGW_BOOK_LIST) {
      const moduleId = BOOK_MODULES[code];
      if (moduleId === undefined) continue;
      let book: EgwBook;
      try {
        book = await loadJsonAsset<EgwBook>(moduleId);
      } catch {
        // Skip a book that genuinely fails to load rather than aborting every other
        // book's migration. Since the top-of-function check only reruns this whole
        // migration while egw_chapters is completely empty, a book that fails here stays
        // missing rather than being retried on a later launch — acceptable since these are
        // bundled assets that should always be present.
        continue;
      }
      for (let i = 0; i < book.chapters.length; i += INSERT_BATCH_SIZE) {
        const chunk = book.chapters.slice(i, i + INSERT_BATCH_SIZE);
        const placeholders = chunk.map(() => '(?,?,?,?,?)').join(',');
        const params = chunk.flatMap((c) => [code, title, c.number, c.title, c.content]);
        await db.runAsync(
          `INSERT INTO egw_chapters (book_code, book_title, chapter_number, chapter_title, content) VALUES ${placeholders}`,
          params
        );
      }
    }
  });
}

export async function getEgwBook(db: SQLiteDatabase, code: string): Promise<EgwBook | undefined> {
  const meta = EGW_BOOK_LIST.find((b) => b.code === code);
  if (!meta) return undefined;
  const rows = await db.getAllAsync<{ chapter_number: number; chapter_title: string; content: string }>(
    'SELECT chapter_number, chapter_title, content FROM egw_chapters WHERE book_code = ? ORDER BY chapter_number',
    code
  );
  if (rows.length === 0) return undefined;
  return {
    code,
    title: meta.title,
    author: 'Ellen G. White',
    chapters: rows.map((r) => ({ number: r.chapter_number, title: r.chapter_title, content: r.content })),
  };
}

export async function getEgwChapter(db: SQLiteDatabase, code: string, number: number): Promise<EgwChapter | undefined> {
  const row = await db.getFirstAsync<{ chapter_title: string; content: string }>(
    'SELECT chapter_title, content FROM egw_chapters WHERE book_code = ? AND chapter_number = ?',
    code,
    number
  );
  return row ? { number, title: row.chapter_title, content: row.content } : undefined;
}
