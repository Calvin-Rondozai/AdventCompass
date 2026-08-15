import type { SQLiteDatabase } from 'expo-sqlite';
import type { HighlightColor } from './highlights';
import { newLocalId } from '@/utils/localId';

export type NoteCategory = 'bible_study' | 'prayer' | 'devotional' | 'sermon' | 'reflection' | 'personal';

// Reuses the same yellow/green/blue/pink palette as verse/paragraph highlighting
// elsewhere in the app, rather than inventing a separate note-color set.
export const NOTE_COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink'];

export const NOTE_CATEGORIES: { key: NoteCategory; label: string }[] = [
  { key: 'bible_study', label: 'Bible Study' },
  { key: 'prayer', label: 'Prayer' },
  { key: 'devotional', label: 'Devotional' },
  { key: 'sermon', label: 'Sermon' },
  { key: 'reflection', label: 'Reflection' },
  { key: 'personal', label: 'Personal' },
];

export type Note = {
  id: number;
  title: string;
  content: string;
  category: NoteCategory;
  linked_verse: string | null;
  pinned: number;
  archived: number;
  reminder_time: string | null;
  reminder_enabled: number;
  checklist: string | null;
  color: HighlightColor | null;
  image_uri: string | null;
  blocks: string | null;
  created_date: string;
};

export type ChecklistItem = { id: string; text: string; done: boolean };

export function parseChecklist(checklist: string | null): ChecklistItem[] {
  if (!checklist) return [];
  try {
    return JSON.parse(checklist);
  } catch {
    return [];
  }
}

export function stringifyChecklist(items: ChecklistItem[]): string | null {
  return items.length ? JSON.stringify(items) : null;
}

// The editor's actual content model: an ordered list of blocks, so a note can hold any
// number of checklists and photos, each insertable wherever the cursor was and
// repositionable by dragging — not just one of each in a fixed spot.
export type NoteBlock =
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'checklist'; items: ChecklistItem[] }
  | { id: string; type: 'image'; uri: string };

export function parseBlocks(json: string | null): NoteBlock[] | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function stringifyBlocks(blocks: NoteBlock[]): string {
  return JSON.stringify(blocks);
}

// `blocks` is the source of truth the editor reads/writes, but several other consumers
// (full-text search, the dashboard's checklist widget, the notes list card's preview
// text/thumbnail) only ever knew about the older flat content/checklist/image_uri
// columns — rather than teach every one of them to understand blocks, this derives
// those columns from `blocks` on every save so they stay correct as simple projections.
export function deriveFromBlocks(blocks: NoteBlock[]): {
  content: string;
  checklist: ChecklistItem[];
  image_uri: string | null;
} {
  const content = blocks
    .filter((b): b is Extract<NoteBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .filter((t) => t.trim().length > 0)
    .join('\n\n');
  const checklist = blocks
    .filter((b): b is Extract<NoteBlock, { type: 'checklist' }> => b.type === 'checklist')
    .flatMap((b) => b.items);
  const image = blocks.find((b): b is Extract<NoteBlock, { type: 'image' }> => b.type === 'image');
  return { content, checklist, image_uri: image?.uri ?? null };
}

// A note saved before `blocks` existed (or one where it failed to parse) — rebuilt as a
// text block, then a checklist block, then an image block, matching the old fixed
// layout, so opening it in the new editor doesn't lose anything.
export function blocksFromLegacyNote(note: Note): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  if (note.content.trim()) blocks.push({ id: newLocalId(), type: 'text', text: note.content });
  const items = parseChecklist(note.checklist);
  if (items.length) blocks.push({ id: newLocalId(), type: 'checklist', items });
  if (note.image_uri) blocks.push({ id: newLocalId(), type: 'image', uri: note.image_uri });
  if (blocks.length === 0) blocks.push({ id: newLocalId(), type: 'text', text: '' });
  return blocks;
}

// A checklist normally renders above the note body. This marker (Unicode Private Use Area
// codepoints, never produced by typing) can be embedded as its own paragraph inside
// `content` to say "the checklist goes here instead". Absent from every note written
// before repositioning existed, so old notes keep rendering the checklist above the body
// exactly as before. Superseded by `blocks` for editing, but still understood here so
// `blocksFromLegacyNote`'s text block doesn't show the raw marker character.
export const CHECKLIST_MARKER = '';

export function splitContentAtChecklist(content: string): { before: string; after: string } {
  const idx = content.indexOf(CHECKLIST_MARKER);
  if (idx === -1) return { before: '', after: content };
  return {
    before: content.slice(0, idx).replace(/\n+$/, ''),
    after: content.slice(idx + CHECKLIST_MARKER.length).replace(/^\n+/, ''),
  };
}

export function formatVerseRef(book: string, chapter: number, verse: number): string {
  return `${book} ${chapter}:${verse}`;
}

export function formatVerseRefMulti(book: string, chapter: number, verses: number[]): string {
  const sorted = [...verses].sort((a, b) => a - b);
  const isContiguous = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
  const verseLabel = isContiguous && sorted.length > 1 ? `${sorted[0]}-${sorted[sorted.length - 1]}` : sorted.join(',');
  return `${book} ${chapter}:${verseLabel}`;
}

export async function getNotes(
  db: SQLiteDatabase,
  options: { search?: string; category?: NoteCategory; archived?: boolean } = {}
): Promise<Note[]> {
  const { search, category, archived = false } = options;
  const clauses = ['archived = ?'];
  const params: (string | number)[] = [archived ? 1 : 0];

  if (category) {
    clauses.push('category = ?');
    params.push(category);
  }
  if (search && search.trim()) {
    clauses.push('(title LIKE ? OR content LIKE ?)');
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }

  return db.getAllAsync<Note>(
    `SELECT * FROM notes WHERE ${clauses.join(' AND ')} ORDER BY pinned DESC, created_date DESC`,
    params
  );
}

export async function getNote(db: SQLiteDatabase, id: number): Promise<Note | null> {
  return db.getFirstAsync<Note>('SELECT * FROM notes WHERE id = ?', id);
}

export async function createNote(
  db: SQLiteDatabase,
  input: {
    title: string;
    category: NoteCategory;
    blocks: NoteBlock[];
    linked_verse?: string | null;
    color?: HighlightColor | null;
  }
): Promise<number> {
  const { content, checklist, image_uri } = deriveFromBlocks(input.blocks);
  const result = await db.runAsync(
    'INSERT INTO notes (title, content, category, linked_verse, pinned, archived, checklist, color, image_uri, blocks, created_date) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)',
    input.title,
    content,
    input.category,
    input.linked_verse ?? null,
    stringifyChecklist(checklist),
    input.color ?? null,
    image_uri,
    stringifyBlocks(input.blocks),
    new Date().toISOString()
  );
  return result.lastInsertRowId;
}

export async function updateNote(
  db: SQLiteDatabase,
  id: number,
  input: {
    title: string;
    category: NoteCategory;
    blocks: NoteBlock[];
    color?: HighlightColor | null;
  }
): Promise<void> {
  const { content, checklist, image_uri } = deriveFromBlocks(input.blocks);
  await db.runAsync(
    'UPDATE notes SET title = ?, content = ?, category = ?, checklist = ?, color = ?, image_uri = ?, blocks = ? WHERE id = ?',
    input.title,
    content,
    input.category,
    stringifyChecklist(checklist),
    input.color ?? null,
    image_uri,
    stringifyBlocks(input.blocks),
    id
  );
}

export async function setNoteReminder(
  db: SQLiteDatabase,
  id: number,
  time: string | null,
  enabled: boolean
): Promise<void> {
  await db.runAsync(
    'UPDATE notes SET reminder_time = ?, reminder_enabled = ? WHERE id = ?',
    time,
    enabled ? 1 : 0,
    id
  );
}

export async function deleteNote(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM notes WHERE id = ?', id);
}

export async function toggleNotePinned(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('UPDATE notes SET pinned = 1 - pinned WHERE id = ?', id);
}

export async function toggleNoteArchived(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('UPDATE notes SET archived = 1 - archived WHERE id = ?', id);
}

export async function getNotesForVerse(db: SQLiteDatabase, verseRef: string): Promise<Note[]> {
  return db.getAllAsync<Note>(
    'SELECT * FROM notes WHERE linked_verse = ? AND archived = 0 ORDER BY created_date DESC',
    verseRef
  );
}

export async function getVersesWithNotes(db: SQLiteDatabase, book: string, chapter: number): Promise<Set<number>> {
  const rows = await db.getAllAsync<{ linked_verse: string }>(
    'SELECT DISTINCT linked_verse FROM notes WHERE archived = 0 AND linked_verse LIKE ?',
    `${book} ${chapter}:%`
  );
  const verses = new Set<number>();
  for (const row of rows) {
    const verseNumber = Number(row.linked_verse.split(':').pop());
    if (!Number.isNaN(verseNumber)) verses.add(verseNumber);
  }
  return verses;
}

export type PendingChecklistItem = { noteId: number; noteTitle: string; item: ChecklistItem };

// Powers the dashboard's checklist preview — the first few unchecked items across every
// non-archived note that has a checklist, most-recent note first.
export async function getPendingChecklistItems(db: SQLiteDatabase, limit = 5): Promise<PendingChecklistItem[]> {
  // ponytail: capped at 50 notes scanned (not just `limit` items returned) — without
  // this the query pulled every non-archived checklist note ever created, full title
  // and content included, just to find the first `limit` unchecked items.
  const rows = await db.getAllAsync<Note>(
    'SELECT * FROM notes WHERE archived = 0 AND checklist IS NOT NULL ORDER BY created_date DESC LIMIT 50'
  );
  const out: PendingChecklistItem[] = [];
  for (const row of rows) {
    for (const item of parseChecklist(row.checklist)) {
      if (item.done) continue;
      out.push({ noteId: row.id, noteTitle: row.title || 'Untitled', item });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

// Toggles one item wherever it lives — a note can now have several checklist blocks, so
// this has to search across all of them, not just one flat list. Updates `blocks` itself
// (not just the derived `checklist` column) so the editor sees the same state next time
// the note is opened, regardless of whether the toggle came from here (the dashboard
// widget) or from inside the editor.
export async function toggleChecklistItem(db: SQLiteDatabase, noteId: number, itemId: string): Promise<void> {
  const note = await getNote(db, noteId);
  if (!note) return;
  const blocks = parseBlocks(note.blocks) ?? blocksFromLegacyNote(note);
  const nextBlocks = blocks.map((b) =>
    b.type === 'checklist' ? { ...b, items: b.items.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it)) } : b
  );
  const { checklist } = deriveFromBlocks(nextBlocks);
  await db.runAsync(
    'UPDATE notes SET checklist = ?, blocks = ? WHERE id = ?',
    stringifyChecklist(checklist),
    stringifyBlocks(nextBlocks),
    noteId
  );
}
