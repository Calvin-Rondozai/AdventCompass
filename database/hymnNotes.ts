import notesData from './hymnNotes.json';

export type HymnNote = {
  author?: string;
  composer?: string;
  verseText?: string;
  verseRef?: string;
  copyright?: string;
};

// Bibliographic/musical notes (author, composer, scripture reference, copyright status) —
// not sheet-music images or audio, see AGENTS.md. Extracted from the real, scanned 1908
// "Christ in Song" hymnal pages published at github.com/adventhymnals/christ-in-song-pdfs,
// keyed here by OUR hymn numbers after verifying an exact title match against that
// archive's 949 hymns (219 of our 300 matched exactly; the rest are intentionally absent
// rather than guessed — see the hymn-notes-import session for the matching method).
// English-only: this is about the hymn/tune's origin, not its translation, so it's shown
// regardless of which language a hymn is being read in.
const NOTES = notesData as Record<string, HymnNote>;

export function getHymnNote(number: number): HymnNote | undefined {
  return NOTES[String(number)];
}
