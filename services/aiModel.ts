import { File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getKv, setKv } from '@/database/kv';

// The model is downloaded once, on first use, and cached in the app's document
// directory — after that, the AI Assistant runs fully offline. Nothing about this file
// touches the network again once the model is present; only the initial fetch does.
// Source: ggml-org's official GGUF quantization of Gemma 3 1B (Q4_K_M) on Hugging Face.
// ("/blob/" is the HTML viewer page — "/resolve/" is the actual file download.)
const MODEL_URL = 'https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf';
const MODEL_FILENAME = 'gemma-3-1b-it-Q4_K_M.gguf';
// HF's Content-Length for this exact file, confirmed directly against the URL above. Used
// only to catch a truncated download left on disk (e.g. the app got killed, or the network
// dropped, mid-download, before our own cleanup in downloadModel's catch could run) — a file
// that exists but is smaller than this was never actually a complete model, just one that
// `exists` alone can't tell apart from a real one.
const EXPECTED_MODEL_BYTES = 806058240;

function modelFile(): File {
  return new File(Paths.document, MODEL_FILENAME);
}

export function getModelPath(): string {
  return modelFile().uri;
}

// Self-heals a truncated leftover (the app got killed, or the network dropped, mid-download,
// before our own cleanup in downloadModel's catch could run) rather than let it sit there
// looking "downloaded" and fail later with an opaque "Failed to load model" from llama.rn.
//
// Must NOT delete while a download is actively in flight (see `downloadPromise` below): a file
// smaller than EXPECTED_MODEL_BYTES is completely normal mid-download, not evidence of a stale
// truncated leftover. This function is called from hasModel()/getActiveModelInfo() too, which
// can run at any time (e.g. a screen re-mounting) while the module-level download is still
// writing bytes to this exact path — deleting it there unlinks the file out from under the
// in-flight write, so the transfer "succeeds" from OkHttp's point of view but the model never
// actually appears on disk once it's done, wasting the entire download for nothing.
function isCompleteModelFile(file: File): boolean {
  if (!file.exists) return false;
  if (file.size < EXPECTED_MODEL_BYTES) {
    if (!downloadPromise) file.delete();
    return false;
  }
  return true;
}

export function hasModel(): boolean {
  return isCompleteModelFile(modelFile());
}

export type DownloadProgress = { bytesWritten: number; totalBytes: number };

// Module-level (not tied to any one screen's component state) so the download keeps running
// and reporting progress even if the AI Assistant screen unmounts — e.g. the user switches to
// another tab mid-download. A second call (from a freshly-mounted screen) just attaches its
// callback to the same in-flight task and shares its result, instead of starting a duplicate
// download or losing track of the one already running.
let downloadPromise: Promise<string> | null = null;
let lastProgress: DownloadProgress | null = null;
const progressListeners = new Set<(p: DownloadProgress) => void>();

export function isDownloadingModel(): boolean {
  return downloadPromise !== null;
}

export function getLastDownloadProgress(): DownloadProgress | null {
  return lastProgress;
}

// This app's network is known to be flaky (the Android dev-client builds have hit the
// same issue repeatedly) — if a download fails partway, the partial file is removed so a
// retry starts clean rather than resuming into a truncated, unusable .gguf.
export function downloadModel(onProgress?: (p: DownloadProgress) => void): Promise<string> {
  // Must check for an in-flight download BEFORE the isCompleteModelFile self-heal check
  // below — that check deletes the destination file if it looks "too small", which is
  // exactly what an actively-downloading file looks like. Re-entering this function while
  // a download is already running (e.g. the AI Assistant screen unmounts and remounts
  // mid-download, re-running the "join an in-flight download" effect) used to run the
  // self-heal check first, deleting the file out from under the OkHttp write that's still
  // in progress — the download would finish "successfully" from the native side but the
  // model would never actually be on disk, silently wasting the entire transfer.
  if (onProgress) progressListeners.add(onProgress);
  if (downloadPromise) return downloadPromise;

  const destination = modelFile();
  if (isCompleteModelFile(destination)) return Promise.resolve(destination.uri);

  const task = File.createDownloadTask(MODEL_URL, destination, {
    onProgress: (p) => {
      lastProgress = { bytesWritten: p.bytesWritten, totalBytes: p.totalBytes };
      progressListeners.forEach((listener) => listener(lastProgress!));
    },
  });

  downloadPromise = (async () => {
    try {
      const file = await task.downloadAsync();
      if (!file) throw new Error('Model download did not complete');
      return file.uri;
    } catch (err) {
      if (destination.exists) destination.delete();
      throw err;
    } finally {
      downloadPromise = null;
      lastProgress = null;
      progressListeners.clear();
    }
  })();

  return downloadPromise;
}

// The raw errors this can throw are native/OkHttp exception text ("Unable to resolve host
// 'huggingface.co': No address associated with hostname") — accurate, but meaningless to
// someone who isn't a developer. This maps the common cases to plain language; anything
// unrecognized still gets a plain-language fallback rather than the raw exception text.
export function describeDownloadError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (/unable to resolve host|no address associated|enotfound|network is unreachable|econnrefused|failed to connect/.test(lower)) {
    return "No internet connection. Check your Wi-Fi or mobile data, then try again.";
  }
  if (/timed? ?out/.test(lower)) {
    return 'The download timed out. Check your connection and try again.';
  }
  if (/abort/.test(lower)) {
    return 'The download was cancelled.';
  }
  return "Couldn't download the AI model right now. Please try again later.";
}

export function deleteModel(): void {
  const file = modelFile();
  if (file.exists) file.delete();
}

// A user can either download the app's bundled model (above) or import their own GGUF
// file — e.g. a different fine-tune/quantization they already have, or one downloaded
// separately without waiting on this app's fetch. Whichever was picked most recently is
// "active"; switching doesn't delete the other one, so flipping back and forth doesn't
// force a re-download/re-import.
export type ModelSourceKind = 'download' | 'import';

const MODEL_SOURCE_KEY = 'ai_model_source';
const IMPORTED_MODEL_NAME_KEY = 'ai_imported_model_name';
// Imported files are copied to this fixed name rather than kept at their picked
// location — a content:// URI from the system picker isn't guaranteed to stay valid
// across app restarts (the granted permission can be revoked, the source app can move
// or delete it), and llama.rn's native loader needs a real, stable file:// path anyway.
const IMPORTED_MODEL_FILENAME = 'imported-model.gguf';

function importedModelFile(): File {
  return new File(Paths.document, IMPORTED_MODEL_FILENAME);
}

export type ActiveModelInfo = {
  source: ModelSourceKind;
  ready: boolean;
  importedName: string | null;
  // The path to hand llama.rn, or null if the active source isn't actually ready yet.
  path: string | null;
};

// Lets the UI offer "switch back to your imported model" without re-picking a file —
// the imported file persists on disk at a fixed path regardless of which source is
// currently active (see importModel/setModelSource).
export function hasImportedModel(): boolean {
  return importedModelFile().exists;
}

export async function getActiveModelInfo(db: SQLiteDatabase): Promise<ActiveModelInfo> {
  const [rawSource, importedName] = await Promise.all([
    getKv(db, MODEL_SOURCE_KEY),
    getKv(db, IMPORTED_MODEL_NAME_KEY),
  ]);
  const source: ModelSourceKind = rawSource === 'import' ? 'import' : 'download';

  if (source === 'import') {
    const file = importedModelFile();
    return { source, ready: file.exists, importedName: importedName || null, path: file.exists ? file.uri : null };
  }
  const file = modelFile();
  const ready = isCompleteModelFile(file);
  return { source, ready, importedName: importedName || null, path: ready ? file.uri : null };
}

// Only .gguf is a valid llama.cpp model format — anything else picked would fail deep
// inside llama.rn's native loader with an opaque, unhelpful error, so this rejects it up
// front with a message the user can actually act on.
export async function importModel(db: SQLiteDatabase, picked: File): Promise<void> {
  if (!picked.name.toLowerCase().endsWith('.gguf')) {
    throw new Error("That doesn't look like a GGUF model file (.gguf). Pick a valid llama.cpp-format model.");
  }
  const dest = importedModelFile();
  if (dest.exists) dest.delete();
  await picked.copy(dest, { overwrite: true });
  await setKv(db, MODEL_SOURCE_KEY, 'import');
  await setKv(db, IMPORTED_MODEL_NAME_KEY, picked.name);
}

export async function setModelSource(db: SQLiteDatabase, kind: ModelSourceKind): Promise<void> {
  await setKv(db, MODEL_SOURCE_KEY, kind);
}

export async function deleteImportedModel(db: SQLiteDatabase): Promise<void> {
  const file = importedModelFile();
  if (file.exists) file.delete();
  await setKv(db, IMPORTED_MODEL_NAME_KEY, '');
  // If the imported model was the active source, fall back to the downloaded one so the
  // UI doesn't keep pointing at a model file that no longer exists.
  const current = await getKv(db, MODEL_SOURCE_KEY);
  if (current === 'import') await setKv(db, MODEL_SOURCE_KEY, 'download');
}
