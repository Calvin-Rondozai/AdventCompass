import type { SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES_SQL, SCHEMA_VERSION } from './schema';
import { loadFullBible } from './loadFullBible';

export const DATABASE_NAME = 'maranatha_one.db';

async function bibleTableHasTranslationColumn(db: SQLiteDatabase): Promise<boolean> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(bible)');
  return columns.some((c) => c.name === 'translation');
}

async function ensureNotesReminderColumns(db: SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(notes)');
  const names = new Set(columns.map((c) => c.name));
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

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  // Check the actual table shape rather than trusting user_version — during development,
  // hot reloads can re-run this against evolving code and leave user_version stamped ahead
  // of what the persisted tables actually look like. Checking the real column is self-healing
  // regardless of how that bookkeeping got out of sync.
  const needsBibleRebuild = !(await bibleTableHasTranslationColumn(db));
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

  await db.execAsync(CREATE_TABLES_SQL);
  await ensureNotesReminderColumns(db);

  if (needsBibleRebuild) {
    await loadFullBible(db);
  }

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;
  if (currentVersion < SCHEMA_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
}
