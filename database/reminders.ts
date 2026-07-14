import type { SQLiteDatabase } from 'expo-sqlite';

export type ReminderKind = 'interval' | 'time' | 'weekly';
export type ReminderType =
  | 'water'
  | 'prayer_morning'
  | 'prayer_afternoon'
  | 'prayer_evening'
  | 'prayer_night'
  | 'bible_study'
  | 'devotional'
  | 'chapter_a_day'
  | 'sabbath_school'
  | 'sabbath_prep'
  | 'sabbath';

export type ReminderDef = {
  type: ReminderType;
  label: string;
  kind: ReminderKind;
  defaultValue: string; // minutes (as a string) for 'interval', "HH:MM" for 'time'/'weekly'
  weekday?: number; // 1-7, Sunday=1 (only for kind 'weekly')
  title: string;
  body: string;
};

export const REMINDER_DEFS: ReminderDef[] = [
  {
    type: 'water',
    label: 'Drink Water',
    kind: 'interval',
    defaultValue: '60',
    title: 'Time to hydrate',
    body: 'Drink a glass of water.',
  },
  {
    type: 'prayer_morning',
    label: 'Morning Prayer',
    kind: 'time',
    defaultValue: '06:00',
    title: 'Morning Prayer',
    body: 'Start your day in prayer.',
  },
  {
    type: 'prayer_afternoon',
    label: 'Afternoon Prayer',
    kind: 'time',
    defaultValue: '12:00',
    title: 'Afternoon Prayer',
    body: 'Take a moment to pray.',
  },
  {
    type: 'prayer_evening',
    label: 'Evening Prayer',
    kind: 'time',
    defaultValue: '19:00',
    title: 'Evening Prayer',
    body: 'End your day in prayer.',
  },
  {
    type: 'prayer_night',
    label: 'Night Prayer',
    kind: 'time',
    defaultValue: '21:30',
    title: 'Night Prayer',
    body: 'End your day in prayer.',
  },
  {
    type: 'bible_study',
    label: 'Bible Reading',
    kind: 'time',
    defaultValue: '07:00',
    title: 'Bible Study',
    body: "It's time for today's reading.",
  },
  {
    type: 'devotional',
    label: 'Devotional',
    kind: 'time',
    defaultValue: '06:30',
    title: 'Devotional',
    body: "Today's devotional is ready.",
  },
  {
    type: 'chapter_a_day',
    label: 'Chapter a Day',
    kind: 'time',
    defaultValue: '06:00',
    title: 'Chapter a Day',
    body: "Today's chapter is ready — open the app to read it.",
  },
  {
    type: 'sabbath_school',
    label: "Sabbath School Lesson",
    kind: 'time',
    defaultValue: '09:00',
    title: 'Sabbath School',
    body: "Today's lesson is ready — open the app to study.",
  },
  {
    type: 'sabbath_prep',
    label: 'Sabbath Preparation',
    kind: 'weekly',
    weekday: 6, // Friday (1=Sunday..7=Saturday)
    defaultValue: '15:00',
    title: 'Prepare for the Sabbath',
    body: 'Get your work in order — the Sabbath begins this evening.',
  },
  {
    type: 'sabbath',
    label: 'Sabbath Reminder',
    kind: 'weekly',
    weekday: 6, // Friday (1=Sunday..7=Saturday)
    defaultValue: '18:00',
    title: 'Sabbath Reminder',
    body: '"Remember the Sabbath day, to keep it holy." — Exodus 20:8',
  },
];

export type Reminder = { type: ReminderType; time: string; enabled: boolean };

export async function getReminders(db: SQLiteDatabase): Promise<Reminder[]> {
  const rows = await db.getAllAsync<{ type: string; time: string; enabled: number }>('SELECT * FROM reminders');
  const byType = new Map(rows.map((r) => [r.type, r]));
  return REMINDER_DEFS.map((def) => {
    const row = byType.get(def.type);
    return { type: def.type, time: row?.time ?? def.defaultValue, enabled: row ? !!row.enabled : false };
  });
}

export async function setReminder(
  db: SQLiteDatabase,
  type: ReminderType,
  time: string,
  enabled: boolean
): Promise<void> {
  const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM reminders WHERE type = ?', type);
  if (existing) {
    await db.runAsync('UPDATE reminders SET time = ?, enabled = ? WHERE id = ?', time, enabled ? 1 : 0, existing.id);
  } else {
    await db.runAsync('INSERT INTO reminders (type, time, enabled) VALUES (?, ?, ?)', type, time, enabled ? 1 : 0);
  }
}
