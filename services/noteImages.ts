import { Directory, File, Paths } from 'expo-file-system';

// A picked image's URI (a gallery/cache location the OS could revoke or the picker's own
// temp file could get cleaned up) is copied into this app-owned directory so it stays
// valid for as long as the note exists, the same reasoning services/aiModel.ts already
// uses Paths.document for.
function noteImagesDir(): Directory {
  const dir = new Directory(Paths.document, 'note_images');
  if (!dir.exists) dir.create();
  return dir;
}

// Deferred require() — expo-image-picker is a native module with real permission
// prompts, so it's only touched once the user actually taps "Photo" on a note, not on
// every note screen open.
function getPicker() {
  return require('expo-image-picker') as typeof import('expo-image-picker');
}

// Launches the system photo picker, copies whatever was chosen into this app's own
// storage, and returns the new permanent URI — or null if the user cancelled or denied
// permission.
export async function pickAndSaveNoteImage(): Promise<string | null> {
  const ImagePicker = getPicker();
  const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!granted) throw new Error('Photo library permission was not granted.');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const source = new File(result.assets[0].uri);
  const ext = source.extension || '.jpg';
  const dest = new File(noteImagesDir(), `${Date.now()}${ext}`);
  await source.copy(dest);
  return dest.uri;
}

export function deleteNoteImage(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Best-effort cleanup — a leftover image file isn't harmful if this fails.
  }
}
