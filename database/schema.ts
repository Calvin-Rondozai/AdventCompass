export const SCHEMA_VERSION = 10;

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

CREATE TABLE IF NOT EXISTS highlights (
  id INTEGER PRIMARY KEY NOT NULL,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  color TEXT NOT NULL,
  created_date TEXT NOT NULL
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

CREATE TABLE IF NOT EXISTS sabbath_highlights (
  id INTEGER PRIMARY KEY NOT NULL,
  quarter_id TEXT NOT NULL,
  week INTEGER NOT NULL,
  day INTEGER NOT NULL,
  block_index INTEGER NOT NULL,
  color TEXT NOT NULL,
  created_date TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_habits_type_date ON habits (habit_type, date);
CREATE INDEX IF NOT EXISTS idx_bible_lookup ON bible (translation, book, chapter, verse);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_verse ON bookmarks (book, chapter, verse);
CREATE UNIQUE INDEX IF NOT EXISTS idx_highlights_verse ON highlights (book, chapter, verse);
CREATE UNIQUE INDEX IF NOT EXISTS idx_egw_highlights_para ON egw_highlights (book, chapter, paragraph);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sabbath_answers_block ON sabbath_answers (quarter_id, week, day, block_index);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sabbath_highlights_block ON sabbath_highlights (quarter_id, week, day, block_index);
`;
