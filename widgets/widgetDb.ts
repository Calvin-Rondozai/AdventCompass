import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { DATABASE_NAME } from '@/database/migrate';

// The widget task handler runs as a headless JS task, outside the app's own React tree
// and its <SQLiteProvider> — it can't reach useSQLiteContext(), so it opens the same
// database file directly instead. The app's own migrateDbIfNeeded runs on every normal
// launch, so by the time a widget exists to click on, the schema this needs (the
// `habits` table) is already guaranteed to be there; this deliberately does NOT run
// migrations itself; a widget update racing the app's own migration is not something
// a bare open should try to referee.
let db: SQLiteDatabase | null = null;

export function getWidgetDb(): SQLiteDatabase {
  if (!db) db = openDatabaseSync(DATABASE_NAME);
  return db;
}
