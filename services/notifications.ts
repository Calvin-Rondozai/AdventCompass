import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Linking, Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import type * as NotificationsModule from 'expo-notifications';
import { getKv, setKv } from '@/database/kv';
import { getReminders, REMINDER_DEFS, ReminderType } from '@/database/reminders';
import { getNotes } from '@/database/notes';
import { getTodaysLesson } from '@/database/sabbathSchool';
import { nextOccurrence, SPECIAL_DAYS } from '@/database/specialDays';

// expo-notifications crashes on import in Expo Go on Android since SDK 53 (it removed
// support and throws instead of just warning) — even just `require`-ing the module is
// enough to crash, regardless of which function is actually called. Reminders only work
// in a development build; in Expo Go every export below becomes a safe no-op.
export const notificationsAvailable = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let Notifications: typeof NotificationsModule | null = null;
if (notificationsAvailable) {
  Notifications = require('expo-notifications');
  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

const ANDROID_CHANNEL_ID = 'reminders';

const EXACT_ALARM_PROMPT_KEY = 'exact_alarm_settings_prompted';

// Android 12+ only fires scheduled reminders at their exact set time if the app holds the
// SCHEDULE_EXACT_ALARM permission (declared in the manifest, but the user still has to flip it
// on in system settings — there's no in-app grant dialog for it). Without it, expo-notifications
// silently falls back to an inexact alarm that Doze/battery optimization can delay by minutes to
// hours. Deep-link to that settings screen once so reminders land on time; harmless no-op on
// versions where the permission doesn't apply.
async function ensureExactAlarmsEnabled(db: SQLiteDatabase): Promise<void> {
  if (Platform.OS !== 'android' || Platform.Version < 31) return;
  const alreadyPrompted = await getKv(db, EXACT_ALARM_PROMPT_KEY);
  if (alreadyPrompted === '1') return;
  await setKv(db, EXACT_ALARM_PROMPT_KEY, '1');
  try {
    await Linking.sendIntent?.('android.settings.REQUEST_SCHEDULE_EXACT_ALARM');
  } catch {
    // Some OEM builds don't expose this settings screen — reminders still work, just
    // possibly inexact, so failing here should never block notification setup.
  }
}

export async function ensureNotificationSetup(db: SQLiteDatabase): Promise<boolean> {
  if (!Notifications) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await ensureExactAlarmsEnabled(db);
  }
  return finalStatus === 'granted';
}

const notificationIdKey = (type: ReminderType) => `notif_id_${type}`;

export async function cancelReminderNotification(db: SQLiteDatabase, type: ReminderType): Promise<void> {
  if (!Notifications) return;
  const id = await getKv(db, notificationIdKey(type));
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await setKv(db, notificationIdKey(type), '');
  }
}

const PRAYER_REMINDER_TYPES: ReminderType[] = ['prayer_morning', 'prayer_afternoon', 'prayer_evening', 'prayer_night'];

async function buildReminderContent(
  db: SQLiteDatabase,
  def: (typeof REMINDER_DEFS)[number]
): Promise<{ title: string; body: string }> {
  if (PRAYER_REMINDER_TYPES.includes(def.type)) {
    const prayerNotes = await getNotes(db, { category: 'prayer' });
    if (prayerNotes.length > 0) {
      const titles = prayerNotes.slice(0, 5).map((n) => n.title).join(', ');
      return { title: def.title, body: `Pray for: ${titles}` };
    }
  }
  if (def.type === 'sabbath_school') {
    const lesson = await getTodaysLesson(db);
    if (lesson) return { title: def.title, body: lesson.lessonTitle };
  }
  return { title: def.title, body: def.body };
}

export async function scheduleReminderNotification(
  db: SQLiteDatabase,
  type: ReminderType,
  time: string
): Promise<void> {
  if (!Notifications) return;
  await cancelReminderNotification(db, type);
  const def = REMINDER_DEFS.find((d) => d.type === type);
  if (!def) return;

  let trigger: NotificationsModule.SchedulableNotificationTriggerInput;
  if (def.kind === 'interval') {
    const minutes = Math.max(1, Number(time) || Number(def.defaultValue));
    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: minutes * 60,
      repeats: true,
      channelId: ANDROID_CHANNEL_ID,
    };
  } else if (def.kind === 'weekly') {
    const [hour, minute] = time.split(':').map(Number);
    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: def.weekday ?? 1,
      hour,
      minute,
      channelId: ANDROID_CHANNEL_ID,
    };
  } else {
    const [hour, minute] = time.split(':').map(Number);
    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: ANDROID_CHANNEL_ID,
    };
  }

  const content = await buildReminderContent(db, def);
  const id = await Notifications.scheduleNotificationAsync({ content, trigger });
  await setKv(db, notificationIdKey(type), id);
}

// Prayer reminder bodies list current prayer-note titles, so they go stale as notes
// change. Call this after any prayer-category note is created/edited/deleted/archived
// to reschedule the (already-enabled) prayer reminders with fresh content.
export async function refreshPrayerReminders(db: SQLiteDatabase): Promise<void> {
  if (!Notifications) return;
  const reminders = await getReminders(db);
  for (const r of reminders) {
    if (PRAYER_REMINDER_TYPES.includes(r.type) && r.enabled) {
      await scheduleReminderNotification(db, r.type, r.time);
    }
  }
}

// The Sabbath School reminder's body names today's lesson title, which changes weekly —
// call this after a successful sync so an already-enabled reminder picks up the new title
// instead of repeating whatever lesson was current when it was first scheduled.
export async function refreshSabbathSchoolReminder(db: SQLiteDatabase): Promise<void> {
  if (!Notifications) return;
  const reminders = await getReminders(db);
  const reminder = reminders.find((r) => r.type === 'sabbath_school');
  if (reminder?.enabled) await scheduleReminderNotification(db, 'sabbath_school', reminder.time);
}

const noteNotificationIdKey = (noteId: number) => `notif_id_note_${noteId}`;

export async function cancelNoteReminder(db: SQLiteDatabase, noteId: number): Promise<void> {
  if (!Notifications) return;
  const id = await getKv(db, noteNotificationIdKey(noteId));
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await setKv(db, noteNotificationIdKey(noteId), '');
  }
}

const SPECIAL_DAYS_YEAR_KEY = 'special_days_scheduled_year';
const SPECIAL_DAYS_NOTIF_IDS_KEY = 'notif_ids_special_days';

// Schedules a one-time notification for every GC special day still ahead this calendar
// year (see database/specialDays.ts) — idempotent per year via a stored flag, so this is
// safe to call on every app launch: it's a no-op once this year's batch is already
// scheduled, and only does real work again the first time it runs after the year rolls
// over (rescheduling next year's dates, which will have shifted slightly in the
// upstream calendar).
export async function scheduleSpecialDayNotifications(db: SQLiteDatabase): Promise<void> {
  if (!Notifications) return;
  const now = new Date();
  const currentYear = String(now.getFullYear());
  const scheduledYear = await getKv(db, SPECIAL_DAYS_YEAR_KEY);
  if (scheduledYear === currentYear) return;

  const existingIdsRaw = await getKv(db, SPECIAL_DAYS_NOTIF_IDS_KEY);
  if (existingIdsRaw) {
    const ids: string[] = JSON.parse(existingIdsRaw);
    await Promise.all(ids.map((id) => Notifications!.cancelScheduledNotificationAsync(id).catch(() => {})));
  }

  const newIds: string[] = [];
  for (const day of SPECIAL_DAYS) {
    const date = nextOccurrence(day, now);
    if (date.getFullYear() !== now.getFullYear()) continue; // already past this year — next year's run will pick it up
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: 'Special Day', body: day.title },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 8, 0, 0),
        channelId: ANDROID_CHANNEL_ID,
      },
    });
    newIds.push(id);
  }
  await setKv(db, SPECIAL_DAYS_NOTIF_IDS_KEY, JSON.stringify(newIds));
  await setKv(db, SPECIAL_DAYS_YEAR_KEY, currentYear);
}

export async function scheduleNoteReminder(
  db: SQLiteDatabase,
  noteId: number,
  title: string,
  time: string
): Promise<void> {
  if (!Notifications) return;
  await cancelNoteReminder(db, noteId);
  const [hour, minute] = time.split(':').map(Number);
  const id = await Notifications.scheduleNotificationAsync({
    content: { title, body: 'Note reminder' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: ANDROID_CHANNEL_ID,
    },
  });
  await setKv(db, noteNotificationIdKey(noteId), id);
}
