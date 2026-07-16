import React, { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Minus, Plus } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getReminders, Reminder, REMINDER_DEFS, ReminderType, setReminder } from '@/database/reminders';
import {
  cancelReminderNotification,
  ensureNotificationSetup,
  notificationsAvailable,
  scheduleReminderNotification,
} from '@/services/notifications';
import { showAlert } from '@/components/ui/AppAlert';
import { PressableScale } from '@/components/ui/PressableScale';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { Body, Heading, Label } from '@/components/ui/Typography';

const INTERVAL_PRESETS = [15, 30, 45, 60, 90, 120];
const WEEKDAY_LABELS = ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

// Every reminder the app can schedule lives in REMINDER_DEFS and is listed here with
// its own on/off switch — the single place with "full control of the notifications"
// the more reminder types pile up (water, prayer x4, Bible study, devotional,
// chapter-a-day, Sabbath prep, Sabbath), the more this screen matters as the one
// control surface for all of them, rather than each being buried on its own feature
// screen.
export default function NotificationsScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [editing, setEditing] = useState<ReminderType | null>(null);
  const [draftHour, setDraftHour] = useState(6);
  const [draftMinute, setDraftMinute] = useState(0);
  const [draftInterval, setDraftInterval] = useState('60');

  const refresh = useCallback(() => {
    getReminders(db).then(setReminders);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleToggle = async (type: ReminderType, nextEnabled: boolean, time: string) => {
    if (nextEnabled) {
      if (!notificationsAvailable) {
        showAlert(
          'Development build required',
          'Reminders need a development build. Expo Go no longer supports scheduled notifications on Android as of SDK 53. This will work once the app is installed as a standalone/dev build.'
        );
        return;
      }
      const granted = await ensureNotificationSetup();
      if (!granted) {
        showAlert(
          'Notifications disabled',
          'Enable notifications for this app in your device settings to use reminders.'
        );
        return;
      }
      await scheduleReminderNotification(db, type, time);
    } else {
      await cancelReminderNotification(db, type);
    }
    await setReminder(db, type, time, nextEnabled);
    refresh();
  };

  const openEditor = (reminder: Reminder) => {
    setEditing(reminder.type);
    const def = REMINDER_DEFS.find((d) => d.type === reminder.type)!;
    if (def.kind !== 'interval') {
      const [h, m] = reminder.time.split(':').map(Number);
      setDraftHour(h);
      setDraftMinute(m);
    } else {
      setDraftInterval(reminder.time);
    }
  };

  const saveEditor = async () => {
    if (!editing) return;
    const def = REMINDER_DEFS.find((d) => d.type === editing)!;
    const reminder = reminders.find((r) => r.type === editing)!;
    const newTime =
      def.kind !== 'interval' ? `${String(draftHour).padStart(2, '0')}:${String(draftMinute).padStart(2, '0')}` : draftInterval;

    if (reminder.enabled) {
      await scheduleReminderNotification(db, editing, newTime);
    }
    await setReminder(db, editing, newTime, reminder.enabled);
    setEditing(null);
    refresh();
  };

  const editingDef = editing ? REMINDER_DEFS.find((d) => d.type === editing) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: theme.spacing.xxl }}>
        {!notificationsAvailable && (
          <View
            style={{
              backgroundColor: theme.colors.accentSoft,
              borderRadius: theme.radius.md,
              padding: theme.spacing.sm + 2,
              marginBottom: theme.spacing.xs,
            }}
          >
            <Body style={{ fontSize: theme.fontSize.sm, color: theme.colors.onAccent }}>
              Reminders need a development build. Expo Go no longer supports scheduled notifications on
              Android since SDK 53. You can still set times below; they'll start working once this app runs
              as a dev/standalone build.
            </Body>
          </View>
        )}
        {reminders.map((reminder) => {
          const def = REMINDER_DEFS.find((d) => d.type === reminder.type)!;
          return (
            <AnimatedCard key={reminder.type}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }}>{def.label}</Body>
                  <Label style={{ marginTop: 2 }}>
                    {def.kind === 'weekly'
                      ? `${WEEKDAY_LABELS[def.weekday ?? 1]} ${formatTime(reminder.time)}`
                      : def.kind === 'time'
                        ? formatTime(reminder.time)
                        : `Every ${reminder.time} min`}
                  </Label>
                </View>
                <PressableScale onPress={() => openEditor(reminder)} scaleTo={0.95}>
                  <View
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: theme.spacing.sm,
                      borderRadius: theme.radius.pill,
                      backgroundColor: theme.colors.surfaceMuted,
                      marginRight: theme.spacing.sm,
                    }}
                  >
                    <Body style={{ fontSize: theme.fontSize.xs, color: theme.colors.textMuted }}>Edit</Body>
                  </View>
                </PressableScale>
                <Switch
                  value={reminder.enabled}
                  onValueChange={(v) => handleToggle(reminder.type, v, reminder.time)}
                  trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.primary }}
                />
              </View>
            </AnimatedCard>
          );
        })}
      </ScrollView>

      <Modal visible={editing !== null} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setEditing(null)}
        >
          <Pressable
            style={{
              width: '85%',
              backgroundColor: theme.colors.background,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.lg,
              gap: theme.spacing.md,
            }}
          >
            <Heading style={{ fontSize: theme.fontSize.md }}>{editingDef?.label}</Heading>
            {editingDef?.kind === 'weekly' && (
              <Label>Every {WEEKDAY_LABELS[editingDef.weekday ?? 1]}</Label>
            )}

            {editingDef?.kind !== 'interval' ? (
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: theme.spacing.lg }}>
                <Stepper
                  value={draftHour}
                  onChange={(v) => setDraftHour(((v % 24) + 24) % 24)}
                  format={(v) => String(v).padStart(2, '0')}
                />
                <Heading style={{ fontSize: theme.fontSize.xl }}>:</Heading>
                <Stepper
                  value={draftMinute}
                  onChange={(v) => setDraftMinute(((v % 60) + 60) % 60)}
                  format={(v) => String(v).padStart(2, '0')}
                  step={15}
                />
              </View>
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                  {INTERVAL_PRESETS.map((minutes) => (
                    <PressableScale key={minutes} onPress={() => setDraftInterval(String(minutes))} scaleTo={0.95}>
                      <View
                        style={{
                          paddingVertical: theme.spacing.xs + 2,
                          paddingHorizontal: theme.spacing.sm + 2,
                          borderRadius: theme.radius.pill,
                          backgroundColor:
                            draftInterval === String(minutes) ? theme.colors.primary : theme.colors.surfaceMuted,
                        }}
                      >
                        <Body
                          style={{
                            fontSize: theme.fontSize.sm,
                            color: draftInterval === String(minutes) ? theme.colors.onPrimary : theme.colors.textMuted,
                          }}
                        >
                          {minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
                        </Body>
                      </View>
                    </PressableScale>
                  ))}
                </View>
                <Label>Or set a custom interval (minutes)</Label>
                <TextInput
                  value={draftInterval}
                  onChangeText={setDraftInterval}
                  keyboardType="number-pad"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    padding: theme.spacing.sm + 2,
                    color: theme.colors.text,
                    fontSize: theme.fontSize.lg,
                  }}
                />
              </View>
            )}

            <PressableScale onPress={saveEditor} scaleTo={0.98}>
              <View
                style={{
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.sm + 2,
                  alignItems: 'center',
                }}
              >
                <Body style={{ color: theme.colors.onPrimary, fontFamily: theme.fontFamily.sansSemiBold }}>Save</Body>
              </View>
            </PressableScale>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Stepper({
  value,
  onChange,
  format,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  step?: number;
}) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
      <PressableScale onPress={() => onChange(value + step)} scaleTo={0.85}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus size={16} color={theme.colors.text} />
        </View>
      </PressableScale>
      <Heading style={{ fontSize: theme.fontSize.xl, minWidth: 48, textAlign: 'center' }}>{format(value)}</Heading>
      <PressableScale onPress={() => onChange(value - step)} scaleTo={0.85}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Minus size={16} color={theme.colors.text} />
        </View>
      </PressableScale>
    </View>
  );
}
