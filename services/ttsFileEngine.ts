import { NativeModules } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { concatWavFiles } from '@/utils/wav';
import { splitForSpeech } from '@/utils/speechText';
import type { ReadAloudChunk } from '@/hooks/useReadAloud';

type TtsFileNativeModule = {
  synthesizeToFile(text: string, outUri: string, voiceId: string | null, rate: number): Promise<string>;
};

// Android-only, backed by android/app/.../ttsfile/TtsFileModule.kt — there is no iOS
// implementation. Throws a clear message rather than a bare "undefined is not a
// function" if called on iOS/web, or on an Android dev client that hasn't been
// rebuilt since this native module was added.
function nativeTtsFile(): TtsFileNativeModule {
  const mod = NativeModules.TtsFile as TtsFileNativeModule | undefined;
  if (!mod) {
    throw new Error(
      'Background audio needs the TtsFile native module (Android-only) — rebuild the dev client to pick it up.'
    );
  }
  return mod;
}

export type ChunkOffset = { key: string; startMs: number; endMs: number };
export type SynthesizedAudio = { file: File; chunkOffsets: ChunkOffset[] };

function sanitizeFilename(title: string): string {
  const cleaned = title.replace(/[\\/:*?"<>|]/g, '-').trim();
  return cleaned.length > 0 ? cleaned : 'reading';
}

// Renders a reader screen's chunks (the same {key, text} list used for live Read Aloud)
// into one playable WAV file, so it can be handed to the global background audio player
// instead of only ever being spoken live. Chunks are synthesized one at a time — the
// native TextToSpeech engine only ever runs one utterance at a time regardless, so this
// mirrors useReadAloud's own one-at-a-time chaining rather than fighting it.
export async function synthesizeChunksToFile(
  chunks: ReadAloudChunk[],
  title: string,
  options: { voice: string | null; rate: number },
  onProgress?: (done: number, total: number) => void
): Promise<SynthesizedAudio> {
  const expanded = chunks.filter((c) => c.text.trim().length > 0).flatMap((c) => splitForSpeech(c.key, c.text));
  if (expanded.length === 0) throw new Error('Nothing to synthesize.');

  const workDir = new Directory(Paths.cache, 'tts_render');
  if (!workDir.exists) workDir.create();

  const tempFiles: File[] = [];
  try {
    for (let i = 0; i < expanded.length; i++) {
      const outFile = new File(workDir, `chunk_${i}.wav`);
      if (outFile.exists) outFile.delete();
      await nativeTtsFile().synthesizeToFile(expanded[i].text, outFile.uri, options.voice, options.rate);
      tempFiles.push(outFile);
      onProgress?.(i + 1, expanded.length);
    }

    const finalFile = new File(Paths.cache, `${sanitizeFilename(title)}.wav`);
    const durationsMs = await concatWavFiles(tempFiles, finalFile);

    let cursor = 0;
    const chunkOffsets: ChunkOffset[] = expanded.map((chunk, i) => {
      const startMs = cursor;
      cursor += durationsMs[i];
      return { key: chunk.key, startMs, endMs: cursor };
    });

    return { file: finalFile, chunkOffsets };
  } finally {
    // Best-effort cleanup — a leftover temp chunk file in the cache dir isn't harmful,
    // so a failure here shouldn't mask the real result/error from the synthesis above.
    tempFiles.forEach((f) => {
      try {
        if (f.exists) f.delete();
      } catch {}
    });
  }
}
