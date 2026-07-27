import type { SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES_SQL, SCHEMA_VERSION } from './schema';
import { loadFullBible } from './loadFullBible';
import { loadEgwBooksIfNeeded } from './egwBooks';

export const DATABASE_NAME = 'maranatha_one.db';

// Schema alone isn't enough to prove the bible table is actually usable: CREATE_TABLES_SQL
// runs and commits before loadFullBible's own DELETE+INSERT transaction, so a load that gets
// interrupted partway (a crash, an OOM parsing a translation's JSON, anything) rolls back all
// the *rows* while leaving the *table + column* already committed from the CREATE step. A
// later launch would then see "translation column exists" and skip loadFullBible forever,
// permanently stuck with a schema-correct but empty table. Checking row count too makes this
// self-healing against exactly that case, not just a missing column.
async function bibleTableNeedsRebuild(db: SQLiteDatabase): Promise<boolean> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(bible)');
  if (!columns.some((c) => c.name === 'translation')) return true;
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM bible');
  return (row?.count ?? 0) === 0;
}

async function ensureNotesReminderColumns(db: SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(notes)');
  const names = new Set(columns.map((c) => c.name));
  // pinned/archived shipped in the same schema change as reminder_time/reminder_enabled
  // on older installs, but only the reminder columns got a backfill ALTER here — an
  // install that predates all four would run every INSERT/UPDATE against a notes table
  // still missing "archived", throwing "no such column: archived" the first time
  // anything touches it (e.g. archiving a note).
  if (!names.has('pinned')) {
    await db.execAsync('ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0');
  }
  if (!names.has('archived')) {
    await db.execAsync('ALTER TABLE notes ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');
  }
  if (!names.has('reminder_time')) {
    await db.execAsync('ALTER TABLE notes ADD COLUMN reminder_time TEXT');
  }
  if (!names.has('reminder_enabled')) {
    await db.execAsync('ALTER TABLE notes ADD COLUMN reminder_enabled INTEGER NOT NULL DEFAULT 0');
  }
  if (!names.has('checklist')) {
    await db.execAsync('ALTER TABLE notes ADD COLUMN checklist TEXT');
  }
}

// sabbath_highlights gained start_word/end_word (schema v13) so a highlight can cover
// just the words picked, not the whole block — existing rows are real user data, so
// backfill columns via ALTER instead of dropping like the caches above. The old unique
// index on (quarter_id, week, day, block_index) also has to go: a block can now hold
// more than one highlighted range.
async function ensureSabbathHighlightsWordColumns(db: SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(sabbath_highlights)');
  if (columns.length === 0) return;
  const names = new Set(columns.map((c) => c.name));
  if (!names.has('start_word')) {
    await db.execAsync('ALTER TABLE sabbath_highlights ADD COLUMN start_word INTEGER NOT NULL DEFAULT -1');
  }
  if (!names.has('end_word')) {
    await db.execAsync('ALTER TABLE sabbath_highlights ADD COLUMN end_word INTEGER NOT NULL DEFAULT -1');
  }
  await db.execAsync('DROP INDEX IF EXISTS idx_sabbath_highlights_block');
}

// SQLiteProvider's onInit can fire twice concurrently (React Native's dev-mode double
// effect invocation) for the same underlying db file. Without this guard, both calls
// race the check-then-act guards below (e.g. loadEgwBooksIfNeeded's "SELECT COUNT then
// insert") and the second run collides with the first's now-committed rows — a UNIQUE
// constraint failure on egw_chapters. Module-level, not per-db, since there's only ever
// one database in this app; a rejected attempt clears the slot so a genuine failure can
// still be retried on the next onInit call rather than being cached forever.
let migrationPromise: Promise<void> | null = null;

export function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = runMigration(db).catch((err) => {
      migrationPromise = null;
      throw err;
    });
  }
  return migrationPromise;
}

async function runMigration(db: SQLiteDatabase) {
  // Check the actual table shape rather than trusting user_version — during development,
  // hot reloads can re-run this against evolving code and leave user_version stamped ahead
  // of what the persisted tables actually look like. Checking the real column (and row
  // count — see bibleTableNeedsRebuild) is self-healing regardless of how that bookkeeping
  // got out of sync.
  const needsBibleRebuild = await bibleTableNeedsRebuild(db);
  if (needsBibleRebuild) {
    await db.execAsync('DROP TABLE IF EXISTS bible');
  }

  // sabbath_quarters gained a composite id (lang/edition support), then a cover image
  // column — old rows are just a re-downloadable cache, so drop and let it recreate
  // rather than a fiddly ALTER.
  const tableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(sabbath_quarters)');
  const tableInfoNames = new Set(tableInfo.map((c) => c.name));
  if (tableInfo.length > 0 && (!tableInfoNames.has('lang') || !tableInfoNames.has('cover'))) {
    await db.execAsync('DROP TABLE IF EXISTS sabbath_quarters');
  }

  // content_search's `title` column moved from UNINDEXED to indexed in schema v12 (so
  // chapter/entry titles are actually searchable, not just body text). FTS5 has no
  // ALTER for a column's indexed-ness, and CREATE VIRTUAL TABLE IF NOT EXISTS is a no-op
  // against a table that already exists regardless of whether this SQL text changed —
  // an install that already created the old shape needs an explicit drop to pick up the
  // new one. Its rows are a fully rebuildable cache (database/searchIndex.ts), never
  // user data, so this is safe the same way the sabbath_quarters drop above is.
  const { user_version: versionBeforeMigration } =
    (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version')) ?? { user_version: 0 };
  if (versionBeforeMigration < 12) {
    await db.execAsync('DROP TABLE IF EXISTS content_search');
  }

  await ensureSabbathHighlightsWordColumns(db);
  await db.execAsync(CREATE_TABLES_SQL);
  await ensureNotesReminderColumns(db);

  if (needsBibleRebuild) {
    await loadFullBible(db);
  }
  await loadEgwBooksIfNeeded(db);

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;
  if (currentVersion < SCHEMA_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
}
