export const SCHEMA_VERSION = 20;

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS bible (
  id INTEGER PRIMARY KEY NOT NULL,
  translation TEXT NOT NULL DEFAULT 'NHEB',
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'personal',
  linked_verse TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  reminder_time TEXT,
  reminder_enabled INTEGER NOT NULL DEFAULT 0,
  checklist TEXT,
  color TEXT,
  image_uri TEXT,
  blocks TEXT,
  created_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prayer (
  id INTEGER PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'praying',
  date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS habits (
  id INTEGER PRIMARY KEY NOT NULL,
  habit_type TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  value INTEGER NOT NULL DEFAULT 0,
  date TEXT NOT NULL
);

-- User-added rows for the Home dashboard's "Today's Schedule" card (alongside the three
-- built-in goals — bible_study/prayer/exercise — which aren't stored here). icon is one of
-- the named choices in components/ui/ScheduleIconPicker.tsx; habits.habit_type for a
-- custom item is this row's id, so its completion/streak/week-history reuses the same
-- habits table and query helpers as the built-in goals with no schema change there.
CREATE TABLE IF NOT EXISTS custom_habits (
  id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL,
  icon TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  time TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS app_kv (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY NOT NULL,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  created_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hymn_favorites (
  id INTEGER PRIMARY KEY NOT NULL,
  language TEXT NOT NULL,
  number INTEGER NOT NULL,
  created_date TEXT NOT NULL
);

-- Generic word-range highlighting shared by every reader that isn't Bible verses or
-- Sabbath School (each of those already has its own dedicated, differently-keyed table —
-- see the highlights and sabbath_highlights tables above). content_type/content_key
-- together identify one page (commentary uses "Genesis|1", beliefs uses the belief
-- number, sermons use the sermon id); block_index is the paragraph/entry within that
-- page, and start_word/end_word are word indices within that block's tokenized text,
-- matching sabbath_highlights' own scheme.
CREATE TABLE IF NOT EXISTS word_highlights (
  id INTEGER PRIMARY KEY NOT NULL,
  content_type TEXT NOT NULL,
  content_key TEXT NOT NULL,
  block_index INTEGER NOT NULL,
  start_word INTEGER NOT NULL,
  end_word INTEGER NOT NULL,
  color TEXT NOT NULL,
  created_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS highlights (
  id INTEGER PRIMARY KEY NOT NULL,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  color TEXT NOT NULL,
  created_date TEXT NOT NULL
);

-- Ellen G. White book content, loaded once from the bundled .datjson assets (see
-- database/egwBooks.ts) instead of being re-read from those assets on every open —
-- SQLite is both faster and doesn't depend on expo-asset's copy-to-cache step succeeding
-- every single time a book is opened.
CREATE TABLE IF NOT EXISTS egw_chapters (
  id INTEGER PRIMARY KEY NOT NULL,
  book_code TEXT NOT NULL,
  book_title TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  chapter_title TEXT NOT NULL,
  content TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS egw_highlights (
  id INTEGER PRIMARY KEY NOT NULL,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  paragraph INTEGER NOT NULL,
  color TEXT NOT NULL,
  created_date TEXT NOT NULL
);

-- id is "{lang}:{code}:{edition}" so the same quarter can be downloaded in more than
-- one language/edition (e.g. English standard + English Easy Reading + Shona) at once.
CREATE TABLE IF NOT EXISTS sabbath_quarters (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'en',
  edition TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  human_date TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  cover TEXT,
  data TEXT NOT NULL,
  downloaded_at TEXT NOT NULL
);

-- Per-question written answers and per-paragraph highlights for Sabbath School lessons,
-- keyed the same way as the quarter itself so different language/edition downloads of
-- the same quarter keep separate notes.
CREATE TABLE IF NOT EXISTS sabbath_answers (
  id INTEGER PRIMARY KEY NOT NULL,
  quarter_id TEXT NOT NULL,
  week INTEGER NOT NULL,
  day INTEGER NOT NULL,
  block_index INTEGER NOT NULL,
  answer TEXT NOT NULL DEFAULT '',
  updated_date TEXT NOT NULL
);

-- start_word/end_word address the specific words highlighted within block_index (so a
-- highlight can cover the section the user picked, not the whole paragraph); -1/-1 marks
-- a legacy whole-block highlight from before word ranges existed. A block can now have
-- more than one range, so there's no longer a uniqueness constraint per block_index.
CREATE TABLE IF NOT EXISTS sabbath_highlights (
  id INTEGER PRIMARY KEY NOT NULL,
  quarter_id TEXT NOT NULL,
  week INTEGER NOT NULL,
  day INTEGER NOT NULL,
  block_index INTEGER NOT NULL,
  start_word INTEGER NOT NULL DEFAULT -1,
  end_word INTEGER NOT NULL DEFAULT -1,
  color TEXT NOT NULL,
  created_date TEXT NOT NULL
);

-- Some Sabbath School age divisions (Cornerstone Connections, Junior PowerPoints) are only
-- published as PDFs on their own official sites, not as the day-by-day text format
-- sabbath_quarters holds — see services/sabbathPdfSync.ts. id is "{division}:{code}"
-- (division is the SabbathAgeDivision suffix, e.g. "-cc"); files is a JSON array of
-- { label, isTeacher, uri } for every PDF downloaded for that division/quarter.
CREATE TABLE IF NOT EXISTS sabbath_pdf_lessons (
  id TEXT PRIMARY KEY NOT NULL,
  division TEXT NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  human_date TEXT NOT NULL,
  files TEXT NOT NULL,
  downloaded_at TEXT NOT NULL
);

-- Full-text index the AI Assistant searches for grounding answers (Bible, EGW books,
-- SDA Bible Commentary, hymns, devotionals). Populated lazily on first AI use (see
-- database/searchIndex.ts) rather than during every migration, since most installs
-- never touch the AI feature. title is indexed (not UNINDEXED) so a chapter/entry whose
-- title is thematically on-point can actually surface — searchContent() weights it
-- higher than body text for exactly that reason.
CREATE VIRTUAL TABLE IF NOT EXISTS content_search USING fts5(
  text, source UNINDEXED, ref UNINDEXED, title,
  tokenize = 'porter unicode61'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_habits_type_date ON habits (habit_type, date);
CREATE INDEX IF NOT EXISTS idx_bible_lookup ON bible (translation, book, chapter, verse);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_verse ON bookmarks (book, chapter, verse);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hymn_favorites ON hymn_favorites (language, number);
CREATE INDEX IF NOT EXISTS idx_word_highlights_lookup ON word_highlights (content_type, content_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_highlights_verse ON highlights (book, chapter, verse);
CREATE UNIQUE INDEX IF NOT EXISTS idx_egw_highlights_para ON egw_highlights (book, chapter, paragraph);
CREATE UNIQUE INDEX IF NOT EXISTS idx_egw_chapters_lookup ON egw_chapters (book_code, chapter_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sabbath_answers_block ON sabbath_answers (quarter_id, week, day, block_index);
CREATE INDEX IF NOT EXISTS idx_sabbath_highlights_lookup ON sabbath_highlights (quarter_id, week, day, block_index);
`;
