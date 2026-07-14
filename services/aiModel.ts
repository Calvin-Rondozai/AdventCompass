import { File, Paths } from 'expo-file-system';

// The model is downloaded once, on first use, and cached in the app's document
// directory — after that, the AI Assistant runs fully offline. Nothing about this file
// touches the network again once the model is present; only the initial fetch does.
// Source: ggml-org's official GGUF quantization of Gemma 3 1B (Q4_K_M) on Hugging Face.
// ("/blob/" is the HTML viewer page — "/resolve/" is the actual file download.)
const MODEL_URL = 'https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf';
const MODEL_FILENAME = 'gemma-3-1b-it-Q4_K_M.gguf';

function modelFile(): File {
  return new File(Paths.document, MODEL_FILENAME);
}

export function getModelPath(): string {
  return modelFile().uri;
}

export function hasModel(): boolean {
  return modelFile().exists;
}

export type DownloadProgress = { bytesWritten: number; totalBytes: number };

// This app's network is known to be flaky (the Android dev-client builds have hit the
// same issue repeatedly) — if a download fails partway, the partial file is removed so a
// retry starts clean rather than resuming into a truncated, unusable .gguf.
export async function downloadModel(onProgress?: (p: DownloadProgress) => void): Promise<string> {
  const destination = modelFile();
  if (destination.exists) return destination.uri;

  const task = File.createDownloadTask(MODEL_URL, destination, {
    onProgress: (p) => onProgress?.({ bytesWritten: p.bytesWritten, totalBytes: p.totalBytes }),
  });

  try {
    const file = await task.downloadAsync();
    if (!file) throw new Error('Model download did not complete');
    return file.uri;
  } catch (err) {
    if (destination.exists) destination.delete();
    throw err;
  }
}

export function deleteModel(): void {
  const file = modelFile();
  if (file.exists) file.delete();
}
