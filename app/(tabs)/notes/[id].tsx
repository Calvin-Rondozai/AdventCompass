import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Bell,
  Check,
  ImageIcon,
  ListChecks,
  Palette,
  Pin,
  Archive,
  Trash2,
  Minus,
  MoreHorizontal,
  Plus,
} from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import {
  blocksFromLegacyNote,
  ChecklistItem,
  createNote,
  deleteNote,
  getNote,
  Note,
  NOTE_CATEGORIES,
  NOTE_COLORS,
  NoteBlock,
  NoteCategory,
  parseBlocks,
  setNoteReminder,
  toggleNoteArchived,
  toggleNotePinned,
  updateNote,
} from '@/database/notes';
import { HIGHLIGHT_HEX, HighlightColor } from '@/database/highlights';
import {
  cancelNoteReminder,
  ensureNotificationSetup,
  notificationsAvailable,
  refreshPrayerReminders,
  scheduleNoteReminder,
} from '@/services/notifications';
import { pickAndSaveNoteImage, deleteNoteImage } from '@/services/noteImages';
import { showAlert } from '@/components/ui/AppAlert';
import { PressableScale } from '@/components/ui/PressableScale';
import { NoteBlockItem } from '@/components/notes/NoteBlockItem';
import { Body, Label } from '@/components/ui/Typography';
import { newLocalId } from '@/utils/localId';

const pad = (n: number) => String(n).padStart(2, '0');

function emptyTextBlock(): NoteBlock {
  return { id: newLocalId(), type: 'text', text: '' };
}

function hasRealContent(blocks: NoteBlock[]): boolean {
  return blocks.some(
    (b) => (b.type === 'text' && b.text.trim().length > 0) || (b.type === 'checklist' && b.items.length > 0) || b.type === 'image'
  );
}

export default function NoteEditorScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ id: string; linkedVerse?: string; category?: string }>();
  const isNew = params.id === 'new';

  const [existing, setExisting] = useState<Note | null>(null);
  const [loaded, setLoaded] = useState(isNew);
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<NoteBlock[]>([emptyTextBlock()]);
  const [category, setCategory] = useState<NoteCategory>((params.category as NoteCategory) || 'personal');
  const [color, setColor] = useState<HighlightColor | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(9);
  const [reminderMinute, setReminderMinute] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);
  const [addMenuVisible, setAddMenuVisible] = useState(false);
  const linkedVerse = existing?.linked_verse ?? params.linkedVerse ?? null;
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const swatchHex = HIGHLIGHT_HEX[theme.scheme];
  const screenBg = color ? swatchHex[color] : theme.colors.background;

  // Where a new Checklist/Photo block gets inserted — the text block that most recently
  // had focus, and the cursor offset within it at that moment. Refs, not state: these
  // update on every keystroke/selection change and don't need to trigger a re-render.
  const focusedTextBlockRef = useRef<string | null>(null);
  const cursorPosRef = useRef(0);
  // Each block's own position within the (single, non-virtualized) block list — reported
  // via onLayout — so a drag's drop point can be compared against every sibling to work
  // out the new order. Relative to the same fixed container regardless of ScrollView
  // scroll offset, so no scroll-position math is needed.
  const blockLayouts = useRef<Map<string, { y: number; height: number }>>(new Map());

  // KeyboardAvoidingView's automatic behavior is unreliable on Android inside a
  // navigator screen (same reasoning as the AI Assistant screen) — measuring the
  // keyboard directly and padding the scroll content by that height keeps whatever's
  // being typed from sitting underneath it.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (isNew) return;
    getNote(db, Number(params.id)).then((note) => {
      if (!note) return;
      setExisting(note);
      setTitle(note.title);
      setBlocks(parseBlocks(note.blocks) ?? blocksFromLegacyNote(note));
      setCategory(note.category);
      setColor(note.color);
      setReminderEnabled(!!note.reminder_enabled);
      if (note.reminder_time) {
        const [h, m] = note.reminder_time.split(':').map(Number);
        setReminderHour(h);
        setReminderMinute(m);
      }
      setLoaded(true);
    });
  }, [db, isNew, params.id]);

  // Persist to whichever row already exists (creating it on first content, the same
  // way it'll be finalized on close) so nothing is lost if the note is backgrounded or
  // swiped away without an explicit save action — the point of autosave.
  const persist = useCallback(
    async (data: { title: string; category: NoteCategory; blocks: NoteBlock[]; color: HighlightColor | null }) => {
      if (existing) {
        await updateNote(db, existing.id, { ...data, title: data.title.trim() || 'Untitled' });
      } else {
        const id = await createNote(db, { ...data, title: data.title.trim() || 'Untitled', linked_verse: linkedVerse });
        setExisting({
          id,
          title: data.title,
          content: '',
          category: data.category,
          linked_verse: linkedVerse,
          pinned: 0,
          archived: 0,
          reminder_time: null,
          reminder_enabled: 0,
          checklist: null,
          color: data.color,
          image_uri: null,
          blocks: JSON.stringify(data.blocks),
          created_date: new Date().toISOString(),
        });
      }
    },
    [db, existing, linkedVerse]
  );

  const autosaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!loaded) return;
    if (!title.trim() && !hasRealContent(blocks) && !existing) return;
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      persist({ title, category, blocks, color });
    }, 700);
    return () => clearTimeout(autosaveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, category, blocks, color, loaded]);

  // Refs mirror the latest state/persist fn so the unmount effect below (which only runs
  // once, on the way out) always flushes whatever was last typed — even if it fires
  // inside the 700ms debounce window, e.g. a quick back-navigation or modal swipe-dismiss.
  const latestRef = useRef({ title, category, blocks, color });
  latestRef.current = { title, category, blocks, color };
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
      if (data.title.trim() || hasRealContent(data.blocks)) {
        persistRef.current(data);
      }
    };
  }, []);

  // Reads title/category/blocks/color from latestRef rather than closing over that state
  // directly, so handleSave's own identity doesn't change on every keystroke. It sits in
  // the header's navigation.setOptions() useLayoutEffect deps below — before this,
  // typing a single character rebuilt the header on every keystroke, the same class of
  // bug found and fixed in the Read Aloud feature's header-rebuild-per-verse issue (see
  // hooks/useReadAloud.ts).
  const handleSave = useCallback(async () => {
    clearTimeout(autosaveTimer.current);
    finalizedRef.current = true;
    const { title, category, blocks, color } = latestRef.current;
    if (!title.trim() && !hasRealContent(blocks)) {
      router.back();
      return;
    }
    await persist({ title, category, blocks, color });
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
          const granted = await ensureNotificationSetup(db);
          if (granted) await scheduleNoteReminder(db, noteId, title.trim() || 'Untitled', reminderTime);
        }
      } else {
        await cancelNoteReminder(db, noteId);
      }
    }
    router.back();
  }, [db, existing, persist, reminderEnabled, reminderHour, reminderMinute]);

  const handleDelete = useCallback(async () => {
    if (existing) {
      finalizedRef.current = true;
      await cancelNoteReminder(db, existing.id);
      blocks.forEach((b) => {
        if (b.type === 'image') deleteNoteImage(b.uri);
      });
      await deleteNote(db, existing.id);
      if (existing.category === 'prayer') refreshPrayerReminders(db).catch(() => {});
      router.back();
    }
  }, [db, existing, blocks]);

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

  // Splits whichever text block last had focus at its remembered cursor position and
  // sandwiches the new block between the two halves — "insert where my pointer is." If
  // nothing was ever focused (e.g. tapping + before touching any text), it's appended at
  // the end instead. Either way, a fresh empty text block always follows so there's
  // somewhere to keep typing right after.
  const insertBlockAtCursor = useCallback((newBlock: NoteBlock) => {
    setBlocks((prev) => {
      const focusedId = focusedTextBlockRef.current;
      const idx = prev.findIndex((b) => b.id === focusedId);
      const target = idx >= 0 ? prev[idx] : null;
      if (!target || target.type !== 'text') {
        return [...prev, newBlock, emptyTextBlock()];
      }
      const cursor = Math.max(0, Math.min(cursorPosRef.current, target.text.length));
      const before = target.text.slice(0, cursor);
      const after = target.text.slice(cursor);
      const next = [...prev];
      next.splice(idx, 1, { ...target, text: before }, newBlock, { id: newLocalId(), type: 'text', text: after });
      return next;
    });
  }, []);

  const handleAddChecklist = useCallback(() => {
    insertBlockAtCursor({ id: newLocalId(), type: 'checklist', items: [{ id: newLocalId(), text: '', done: false }] });
  }, [insertBlockAtCursor]);

  const handleAddImage = useCallback(async () => {
    try {
      const uri = await pickAndSaveNoteImage();
      if (uri) insertBlockAtCursor({ id: newLocalId(), type: 'image', uri });
    } catch (error) {
      showAlert('Could not add photo', error instanceof Error ? error.message : 'Please try again.');
    }
  }, [insertBlockAtCursor]);

  const handleBlockLayout = useCallback((id: string, y: number, height: number) => {
    blockLayouts.current.set(id, { y, height });
  }, []);

  // Tracks where the drag HANDLE ends up (the block's own top edge, plus however far the
  // gesture moved it) rather than the dragged block's own center — a checklist with
  // several items or a tall photo has a center well below where its handle actually
  // sits, and comparing centers-to-centers there made the drop consistently overshoot
  // by one block. The handle position is compared against every OTHER block's center to
  // count how many now sit above it — that count is the new index.
  const handleBlockDragEnd = useCallback((id: string, finalTranslateY: number) => {
    const layout = blockLayouts.current.get(id);
    if (!layout) return;
    const draggedHandleY = layout.y + finalTranslateY;
    setBlocks((prev) => {
      const fromIndex = prev.findIndex((b) => b.id === id);
      if (fromIndex === -1) return prev;
      let newIndex = 0;
      for (const b of prev) {
        if (b.id === id) continue;
        const l = blockLayouts.current.get(b.id);
        if (l && l.y + l.height / 2 < draggedHandleY) newIndex++;
      }
      if (newIndex === fromIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(newIndex, 0, moved);
      return next;
    });
  }, []);

  const handleTextChange = useCallback((id: string, text: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === id && b.type === 'text' ? { ...b, text } : b)));
  }, []);

  const handleTextFocus = useCallback((id: string) => {
    focusedTextBlockRef.current = id;
  }, []);

  const handleTextSelectionChange = useCallback((id: string, start: number) => {
    if (focusedTextBlockRef.current === id) cursorPosRef.current = start;
  }, []);

  const handleChecklistChange = useCallback((id: string, items: ChecklistItem[]) => {
    setBlocks((prev) => prev.map((b) => (b.id === id && b.type === 'checklist' ? { ...b, items } : b)));
  }, []);

  const handleRemoveBlock = useCallback((id: string) => {
    setBlocks((prev) => {
      const target = prev.find((b) => b.id === id);
      if (target?.type === 'image') deleteNoteImage(target.uri);
      const next = prev.filter((b) => b.id !== id);
      return next.length ? next : [emptyTextBlock()];
    });
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isNew && !existing ? 'New Note' : 'Note',
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <PressableScale onPress={() => setAddMenuVisible(true)} style={{ padding: theme.spacing.xs }}>
            <Plus size={22} color={theme.colors.text} strokeWidth={2} />
          </PressableScale>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={[]}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.lg + keyboardHeight, gap: theme.spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
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

        {reminderEnabled && (
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
                thumbColor={reminderEnabled ? theme.colors.onPrimary : theme.colors.surfaceElevated}
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg }}>
              <TimeStepper value={reminderHour} onChange={(v) => setReminderHour(((v % 24) + 24) % 24)} />
              <Body style={{ fontFamily: theme.fontFamily.sansSemiBold, fontSize: theme.fontSize.lg }}>:</Body>
              <TimeStepper value={reminderMinute} onChange={(v) => setReminderMinute(((v % 60) + 60) % 60)} step={5} />
            </View>
            {!notificationsAvailable && (
              <Body style={{ fontSize: theme.fontSize.xs, color: theme.colors.textMuted }}>
                Needs a development build to actually fire.
              </Body>
            )}
          </View>
        )}

        {blocks.map((block) => (
          <NoteBlockItem
            key={block.id}
            block={block}
            onLayout={handleBlockLayout}
            onDragEnd={handleBlockDragEnd}
            onTextChange={handleTextChange}
            onTextFocus={handleTextFocus}
            onTextSelectionChange={handleTextSelectionChange}
            onChecklistChange={handleChecklistChange}
            onRemoveBlock={handleRemoveBlock}
          />
        ))}
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

      <Modal visible={addMenuVisible} transparent animationType="fade" onRequestClose={() => setAddMenuVisible(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setAddMenuVisible(false)}>
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
                setAddMenuVisible(false);
                handleAddChecklist();
              }}
              scaleTo={0.99}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md }}>
                <ListChecks size={20} color={theme.colors.text} strokeWidth={1.75} />
                <Body style={{ marginLeft: theme.spacing.sm, fontFamily: theme.fontFamily.sansMedium }}>Checklist</Body>
              </View>
            </PressableScale>
            <PressableScale
              onPress={() => {
                setAddMenuVisible(false);
                handleAddImage();
              }}
              scaleTo={0.99}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md }}>
                <ImageIcon size={20} color={theme.colors.text} strokeWidth={1.75} />
                <Body style={{ marginLeft: theme.spacing.sm, fontFamily: theme.fontFamily.sansMedium }}>Photo</Body>
              </View>
            </PressableScale>
            {!reminderEnabled && (
              <PressableScale
                onPress={() => {
                  setAddMenuVisible(false);
                  setReminderEnabled(true);
                }}
                scaleTo={0.99}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md }}>
                  <Bell size={20} color={theme.colors.text} strokeWidth={1.75} />
                  <Body style={{ marginLeft: theme.spacing.sm, fontFamily: theme.fontFamily.sansMedium }}>Reminder</Body>
                </View>
              </PressableScale>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md, gap: theme.spacing.sm }}>
              <Palette size={20} color={theme.colors.text} strokeWidth={1.75} />
              <Body style={{ fontFamily: theme.fontFamily.sansMedium, marginRight: theme.spacing.xs }}>Color</Body>
              <PressableScale onPress={() => setColor(null)} scaleTo={0.85}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: theme.radius.pill,
                    backgroundColor: theme.colors.surfaceMuted,
                    borderWidth: color === null ? 2 : 1,
                    borderColor: color === null ? theme.colors.primary : theme.colors.border,
                  }}
                />
              </PressableScale>
              {NOTE_COLORS.map((c) => (
                <PressableScale key={c} onPress={() => setColor(c)} scaleTo={0.85}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: theme.radius.pill,
                      backgroundColor: swatchHex[c],
                      borderWidth: color === c ? 2 : 0,
                      borderColor: theme.colors.primary,
                    }}
                  />
                </PressableScale>
              ))}
            </View>
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
