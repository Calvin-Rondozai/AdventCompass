import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Pin,
  Archive,
  Trash2,
  Minus,
  MoreHorizontal,
  Plus,
  X,
} from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import {
  ChecklistItem,
  createNote,
  deleteNote,
  getNote,
  joinContentAroundChecklist,
  Note,
  NOTE_CATEGORIES,
  NoteCategory,
  parseChecklist,
  setNoteReminder,
  splitContentAtChecklist,
  toggleNoteArchived,
  toggleNotePinned,
  updateNote,
} from '@/database/notes';
import {
  cancelNoteReminder,
  ensureNotificationSetup,
  notificationsAvailable,
  refreshPrayerReminders,
  scheduleNoteReminder,
} from '@/services/notifications';
import { showAlert } from '@/components/ui/AppAlert';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Label } from '@/components/ui/Typography';
import { newLocalId as newChecklistId } from '@/utils/localId';

const pad = (n: number) => String(n).padStart(2, '0');
const splitParagraphs = (text: string) => text.split(/\n\n+/).filter((p) => p.trim().length > 0);

export default function NoteEditorScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ id: string; linkedVerse?: string; category?: string }>();
  const isNew = params.id === 'new';

  const [existing, setExisting] = useState<Note | null>(null);
  const [loaded, setLoaded] = useState(isNew);
  const [title, setTitle] = useState('');
  // The note body is split around the checklist so it can be repositioned — everything
  // before it and everything after are separate fields; joined back into one `content`
  // string (with an invisible marker at the split point) only when persisting.
  const [contentBefore, setContentBefore] = useState('');
  const [contentAfter, setContentAfter] = useState('');
  const [category, setCategory] = useState<NoteCategory>((params.category as NoteCategory) || 'personal');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(9);
  const [reminderMinute, setReminderMinute] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);
  const linkedVerse = existing?.linked_verse ?? params.linkedVerse ?? null;

  useEffect(() => {
    if (isNew) return;
    getNote(db, Number(params.id)).then((note) => {
      if (!note) return;
      setExisting(note);
      setTitle(note.title);
      const { before, after } = splitContentAtChecklist(note.content);
      setContentBefore(before);
      setContentAfter(after);
      setCategory(note.category);
      setChecklist(parseChecklist(note.checklist));
      setReminderEnabled(!!note.reminder_enabled);
      if (note.reminder_time) {
        const [h, m] = note.reminder_time.split(':').map(Number);
        setReminderHour(h);
        setReminderMinute(m);
      }
      setLoaded(true);
    });
  }, [db, isNew, params.id]);

  const moveChecklistUp = () => {
    const beforeParas = splitParagraphs(contentBefore);
    if (beforeParas.length === 0) return;
    const moved = beforeParas.pop()!;
    setContentBefore(beforeParas.join('\n\n'));
    setContentAfter([moved, contentAfter].filter((s) => s.trim()).join('\n\n'));
  };
  const moveChecklistDown = () => {
    const afterParas = splitParagraphs(contentAfter);
    if (afterParas.length === 0) return;
    const moved = afterParas.shift()!;
    setContentAfter(afterParas.join('\n\n'));
    setContentBefore([contentBefore, moved].filter((s) => s.trim()).join('\n\n'));
  };

  // Persist to whichever row already exists (creating it on first content, the same
  // way it'll be finalized on close) so nothing is lost if the note is backgrounded or
  // swiped away without an explicit save action — the point of autosave.
  const persist = useCallback(
    async (data: { title: string; content: string; category: NoteCategory; checklist: ChecklistItem[] }) => {
      if (existing) {
        await updateNote(db, existing.id, { ...data, title: data.title.trim() || 'Untitled' });
      } else {
        const id = await createNote(db, { ...data, title: data.title.trim() || 'Untitled', linked_verse: linkedVerse });
        setExisting({
          id,
          title: data.title,
          content: data.content,
          category: data.category,
          linked_verse: linkedVerse,
          pinned: 0,
          archived: 0,
          reminder_time: null,
          reminder_enabled: 0,
          checklist: null,
          created_date: new Date().toISOString(),
        });
      }
    },
    [db, existing, linkedVerse]
  );

  const autosaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!loaded) return;
    if (!title.trim() && !contentBefore.trim() && !contentAfter.trim() && checklist.length === 0 && !existing) return;
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      persist({ title, content: joinContentAroundChecklist(contentBefore, contentAfter), category, checklist });
    }, 700);
    return () => clearTimeout(autosaveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, contentBefore, contentAfter, category, checklist, loaded]);

  // Refs mirror the latest state/persist fn so the unmount effect below (which only runs
  // once, on the way out) always flushes whatever was last typed — even if it fires
  // inside the 700ms debounce window, e.g. a quick back-navigation or modal swipe-dismiss.
  const latestRef = useRef({ title, contentBefore, contentAfter, category, checklist });
  latestRef.current = { title, contentBefore, contentAfter, category, checklist };
  const persistRef = useRef(persist);
  persistRef.current = persist;
  // Set once handleSave or handleDelete has already settled this note's fate, so the
  // unmount flush below doesn't redundantly re-persist data handleSave just saved, or
  // write a no-op UPDATE against a row handleDelete just removed.
  const finalizedRef = useRef(false);
  useEffect(() => {
    return () => {
      clearTimeout(autosaveTimer.current);
      if (finalizedRef.current) return;
      const data = latestRef.current;
      if (data.title.trim() || data.contentBefore.trim() || data.contentAfter.trim() || data.checklist.length > 0) {
        persistRef.current({
          title: data.title,
          content: joinContentAroundChecklist(data.contentBefore, data.contentAfter),
          category: data.category,
          checklist: data.checklist,
        });
      }
    };
  }, []);

  const handleSave = useCallback(async () => {
    clearTimeout(autosaveTimer.current);
    finalizedRef.current = true;
    if (!title.trim() && !contentBefore.trim() && !contentAfter.trim() && checklist.length === 0) {
      router.back();
      return;
    }
    await persist({ title, content: joinContentAroundChecklist(contentBefore, contentAfter), category, checklist });
    const noteId = existing?.id ?? null;
    if (category === 'prayer' || existing?.category === 'prayer') refreshPrayerReminders(db).catch(() => {});

    if (noteId != null) {
      const reminderTime = `${pad(reminderHour)}:${pad(reminderMinute)}`;
      await setNoteReminder(db, noteId, reminderEnabled ? reminderTime : null, reminderEnabled);
      if (reminderEnabled) {
        if (!notificationsAvailable) {
          showAlert(
            'Development build required',
            'Note reminders need a development build. This will work once the app is installed as a dev/standalone build.'
          );
        } else {
          const granted = await ensureNotificationSetup();
          if (granted) await scheduleNoteReminder(db, noteId, title.trim() || 'Untitled', reminderTime);
        }
      } else {
        await cancelNoteReminder(db, noteId);
      }
    }
    router.back();
  }, [db, existing, title, contentBefore, contentAfter, category, checklist, persist, reminderEnabled, reminderHour, reminderMinute]);

  const handleDelete = useCallback(async () => {
    if (existing) {
      finalizedRef.current = true;
      await cancelNoteReminder(db, existing.id);
      await deleteNote(db, existing.id);
      if (existing.category === 'prayer') refreshPrayerReminders(db).catch(() => {});
      router.back();
    }
  }, [db, existing]);

  const handleTogglePin = useCallback(async () => {
    if (!existing) return;
    await toggleNotePinned(db, existing.id);
    setExisting({ ...existing, pinned: existing.pinned ? 0 : 1 });
  }, [db, existing]);

  const handleToggleArchive = useCallback(async () => {
    if (!existing) return;
    await toggleNoteArchived(db, existing.id);
    if (existing.category === 'prayer') refreshPrayerReminders(db).catch(() => {});
    router.back();
  }, [db, existing]);

  const addChecklistItem = () => setChecklist((items) => [...items, { id: newChecklistId(), text: '', done: false }]);
  const updateChecklistText = (id: string, text: string) =>
    setChecklist((items) => items.map((it) => (it.id === id ? { ...it, text } : it)));
  const toggleChecklistDone = (id: string) =>
    setChecklist((items) => items.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
  const removeChecklistItem = (id: string) => setChecklist((items) => items.filter((it) => it.id !== id));

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isNew && !existing ? 'New Note' : 'Note',
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {!!existing && (
            <PressableScale onPress={() => setMenuVisible(true)} style={{ padding: theme.spacing.xs }}>
              <MoreHorizontal size={22} color={theme.colors.text} strokeWidth={1.75} />
            </PressableScale>
          )}
          <PressableScale onPress={handleSave} style={{ padding: theme.spacing.xs }}>
            <Check size={22} color={theme.colors.primary} strokeWidth={2.25} />
          </PressableScale>
        </View>
      ),
    });
  }, [navigation, theme, isNew, existing, handleSave]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={[]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        {!!linkedVerse && (
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: theme.colors.primarySoft,
              borderRadius: theme.radius.pill,
              paddingVertical: theme.spacing.xs,
              paddingHorizontal: theme.spacing.sm + 2,
            }}
          >
            <Body style={{ color: theme.colors.primary, fontSize: theme.fontSize.sm, fontFamily: theme.fontFamily.sansSemiBold }}>
              {linkedVerse}
            </Body>
          </View>
        )}

        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor={theme.colors.textFaint}
          style={{
            fontFamily: theme.fontFamily.serifSemiBold,
            fontSize: theme.fontSize.xl,
            color: theme.colors.text,
          }}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
          {NOTE_CATEGORIES.map((c) => (
            <PressableScale key={c.key} onPress={() => setCategory(c.key)} scaleTo={0.96}>
              <View
                style={{
                  paddingVertical: theme.spacing.xs + 2,
                  paddingHorizontal: theme.spacing.sm + 2,
                  borderRadius: theme.radius.pill,
                  backgroundColor: category === c.key ? theme.colors.primary : theme.colors.surfaceMuted,
                }}
              >
                <Body
                  style={{
                    fontSize: theme.fontSize.sm,
                    color: category === c.key ? theme.colors.onPrimary : theme.colors.textMuted,
                    fontFamily: theme.fontFamily.sansMedium,
                  }}
                >
                  {c.label}
                </Body>
              </View>
            </PressableScale>
          ))}
        </ScrollView>

        <View
          style={{
            backgroundColor: theme.colors.surfaceMuted,
            borderRadius: theme.radius.md,
            padding: theme.spacing.sm + 2,
            gap: theme.spacing.sm,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Bell size={16} color={theme.colors.primary} strokeWidth={1.75} />
            <Body style={{ flex: 1, marginLeft: theme.spacing.xs, fontFamily: theme.fontFamily.sansMedium }}>
              Remind me
            </Body>
            <Switch
              value={reminderEnabled}
              onValueChange={setReminderEnabled}
              trackColor={{ false: theme.colors.surface, true: theme.colors.primary }}
            />
          </View>
          {reminderEnabled && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg }}>
              <TimeStepper value={reminderHour} onChange={(v) => setReminderHour(((v % 24) + 24) % 24)} />
              <Body style={{ fontFamily: theme.fontFamily.sansSemiBold, fontSize: theme.fontSize.lg }}>:</Body>
              <TimeStepper value={reminderMinute} onChange={(v) => setReminderMinute(((v % 60) + 60) % 60)} step={5} />
            </View>
          )}
          {!notificationsAvailable && reminderEnabled && (
            <Body style={{ fontSize: theme.fontSize.xs, color: theme.colors.textMuted }}>
              Needs a development build to actually fire.
            </Body>
          )}
        </View>

        <TextInput
          value={contentBefore}
          onChangeText={setContentBefore}
          placeholder="Write text above the checklist… (optional)"
          placeholderTextColor={theme.colors.textFaint}
          multiline
          textAlignVertical="top"
          style={{
            fontFamily: theme.fontFamily.sansRegular,
            fontSize: theme.fontSize.base,
            lineHeight: theme.lineHeight.base,
            color: theme.colors.text,
            minHeight: 44,
          }}
        />

        {checklist.length > 0 ? (
          <View
            style={{
              backgroundColor: theme.colors.surfaceMuted,
              borderRadius: theme.radius.md,
              padding: theme.spacing.sm + 2,
              gap: theme.spacing.xs,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Label>Checklist</Label>
              <View style={{ flexDirection: 'row' }}>
                <PressableScale onPress={moveChecklistUp} style={{ padding: theme.spacing.xs }} scaleTo={0.85}>
                  <ChevronUp size={16} color={theme.colors.textMuted} />
                </PressableScale>
                <PressableScale onPress={moveChecklistDown} style={{ padding: theme.spacing.xs }} scaleTo={0.85}>
                  <ChevronDown size={16} color={theme.colors.textMuted} />
                </PressableScale>
              </View>
            </View>
            {checklist.map((item) => (
              <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <PressableScale onPress={() => toggleChecklistDone(item.id)} style={{ padding: theme.spacing.xs }}>
                  <CheckCircle2
                    size={20}
                    color={item.done ? theme.colors.primary : theme.colors.textFaint}
                    fill={item.done ? theme.colors.primary : 'transparent'}
                  />
                </PressableScale>
                <TextInput
                  value={item.text}
                  onChangeText={(text) => updateChecklistText(item.id, text)}
                  placeholder="List item"
                  placeholderTextColor={theme.colors.textFaint}
                  style={{
                    flex: 1,
                    fontFamily: theme.fontFamily.sansRegular,
                    fontSize: theme.fontSize.base,
                    color: item.done ? theme.colors.textFaint : theme.colors.text,
                    textDecorationLine: item.done ? 'line-through' : 'none',
                  }}
                />
                <PressableScale onPress={() => removeChecklistItem(item.id)} style={{ padding: theme.spacing.xs }}>
                  <X size={16} color={theme.colors.textFaint} />
                </PressableScale>
              </View>
            ))}
            <PressableScale onPress={addChecklistItem} scaleTo={0.98}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: theme.spacing.xs }}>
                <Plus size={18} color={theme.colors.primary} strokeWidth={2} />
                <Body style={{ marginLeft: theme.spacing.xs, color: theme.colors.primary, fontFamily: theme.fontFamily.sansMedium }}>
                  Add checklist item
                </Body>
              </View>
            </PressableScale>
          </View>
        ) : (
          <PressableScale onPress={addChecklistItem} scaleTo={0.98}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <CheckCircle2 size={18} color={theme.colors.primary} strokeWidth={1.75} />
              <Body style={{ marginLeft: theme.spacing.xs, color: theme.colors.primary, fontFamily: theme.fontFamily.sansMedium }}>
                Add checklist
              </Body>
            </View>
          </PressableScale>
        )}

        <TextInput
          value={contentAfter}
          onChangeText={setContentAfter}
          placeholder="Write your note…"
          placeholderTextColor={theme.colors.textFaint}
          multiline
          textAlignVertical="top"
          style={{
            fontFamily: theme.fontFamily.sansRegular,
            fontSize: theme.fontSize.base,
            lineHeight: theme.lineHeight.base,
            color: theme.colors.text,
            minHeight: 160,
          }}
        />
      </ScrollView>

      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setMenuVisible(false)}>
          <Pressable
            style={{
              marginTop: 'auto',
              backgroundColor: theme.colors.background,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              padding: theme.spacing.lg,
              paddingBottom: theme.spacing.xl,
              gap: theme.spacing.xs,
            }}
          >
            <PressableScale
              onPress={() => {
                setMenuVisible(false);
                handleTogglePin();
              }}
              scaleTo={0.99}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md }}>
                <Pin
                  size={20}
                  color={existing?.pinned ? theme.colors.accent : theme.colors.text}
                  fill={existing?.pinned ? theme.colors.accent : 'transparent'}
                  strokeWidth={1.75}
                />
                <Body style={{ marginLeft: theme.spacing.sm, fontFamily: theme.fontFamily.sansMedium }}>
                  {existing?.pinned ? 'Unpin' : 'Pin'}
                </Body>
              </View>
            </PressableScale>
            <PressableScale
              onPress={() => {
                setMenuVisible(false);
                handleToggleArchive();
              }}
              scaleTo={0.99}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md }}>
                <Archive size={20} color={theme.colors.text} strokeWidth={1.75} />
                <Body style={{ marginLeft: theme.spacing.sm, fontFamily: theme.fontFamily.sansMedium }}>
                  {existing?.archived ? 'Unarchive' : 'Archive'}
                </Body>
              </View>
            </PressableScale>
            <PressableScale
              onPress={() => {
                setMenuVisible(false);
                handleDelete();
              }}
              scaleTo={0.99}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md }}>
                <Trash2 size={20} color={theme.colors.danger} strokeWidth={1.75} />
                <Body style={{ marginLeft: theme.spacing.sm, fontFamily: theme.fontFamily.sansMedium, color: theme.colors.danger }}>
                  Delete
                </Body>
              </View>
            </PressableScale>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function TimeStepper({ value, onChange, step = 1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
      <PressableScale onPress={() => onChange(value - step)} scaleTo={0.85}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Minus size={14} color={theme.colors.text} />
        </View>
      </PressableScale>
      <Body style={{ fontFamily: theme.fontFamily.sansSemiBold, fontSize: theme.fontSize.lg, minWidth: 28, textAlign: 'center' }}>
        {pad(value)}
      </Body>
      <PressableScale onPress={() => onChange(value + step)} scaleTo={0.85}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus size={14} color={theme.colors.text} />
        </View>
      </PressableScale>
    </View>
  );
}
