import { File, Paths } from 'expo-file-system';

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
function isCompleteModelFile(file: File): boolean {
  if (!file.exists) return false;
  if (file.size < EXPECTED_MODEL_BYTES) {
    file.delete();
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
  const destination = modelFile();
  if (isCompleteModelFile(destination)) return Promise.resolve(destination.uri);

  if (onProgress) progressListeners.add(onProgress);
  if (downloadPromise) return downloadPromise;

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
