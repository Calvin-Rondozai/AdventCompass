import { File } from 'expo-file-system';

export type WavInfo = {
  dataOffset: number;
  dataLength: number;
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
  byteRate: number;
};

function chunkId(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

// Android's TextToSpeech.synthesizeToFile always writes plain PCM WAV — this walks the
// standard RIFF chunk layout (rather than assuming "fmt " and "data" sit at fixed offsets)
// since some encoders insert extra chunks (e.g. "LIST") before "data".
export function parseWav(bytes: Uint8Array): WavInfo {
  if (chunkId(bytes, 0) !== 'RIFF' || chunkId(bytes, 8) !== 'WAVE') {
    throw new Error('Not a valid WAV file');
  }
  let offset = 12;
  let sampleRate = 0;
  let numChannels = 0;
  let bitsPerSample = 0;
  let byteRate = 0;
  let dataOffset = -1;
  let dataLength = 0;

  while (offset + 8 <= bytes.length) {
    const id = chunkId(bytes, offset);
    const size = readUint32LE(bytes, offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      numChannels = readUint16LE(bytes, body + 2);
      sampleRate = readUint32LE(bytes, body + 4);
      byteRate = readUint32LE(bytes, body + 8);
      bitsPerSample = readUint16LE(bytes, body + 14);
    } else if (id === 'data') {
      dataOffset = body;
      dataLength = size;
      break; // "data" is effectively always last and can be large — stop once found
    }
    offset = body + size + (size % 2); // RIFF chunks are word-aligned (padded to an even size)
  }

  if (dataOffset < 0 || sampleRate === 0) throw new Error('WAV file missing fmt or data chunk');
  return { dataOffset, dataLength, sampleRate, numChannels, bitsPerSample, byteRate };
}

function buildWavHeader(dataLength: number, sampleRate: number, numChannels: number, bitsPerSample: number): Uint8Array {
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size (PCM)
  view.setUint16(20, 1, true); // audio format: PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataLength, true);
  return new Uint8Array(buffer);
}

// Concatenates several WAV files produced by sequential synthesizeToFile calls into one
// file. Safe only because every chunk comes from the same TTS engine/voice/rate in the
// same call session, so their PCM format is guaranteed identical — this does not attempt
// to resample or transcode mismatched formats. Returns each input file's duration in
// milliseconds (derived from its own data length and byte rate), in order, so the caller
// can build cumulative start/end offsets for paragraph-synced playback highlighting.
export async function concatWavFiles(files: File[], destination: File): Promise<number[]> {
  if (files.length === 0) throw new Error('No audio chunks to concatenate');

  const parsed = await Promise.all(
    files.map(async (file) => {
      const bytes = await file.bytes();
      return { bytes, info: parseWav(bytes) };
    })
  );

  const { sampleRate, numChannels, bitsPerSample } = parsed[0].info;
  const totalDataLength = parsed.reduce((sum, p) => sum + p.info.dataLength, 0);
  const header = buildWavHeader(totalDataLength, sampleRate, numChannels, bitsPerSample);

  const combined = new Uint8Array(header.length + totalDataLength);
  combined.set(header, 0);
  let cursor = header.length;
  const durationsMs: number[] = [];
  for (const { bytes, info } of parsed) {
    combined.set(bytes.subarray(info.dataOffset, info.dataOffset + info.dataLength), cursor);
    cursor += info.dataLength;
    durationsMs.push(info.byteRate > 0 ? (info.dataLength / info.byteRate) * 1000 : 0);
  }

  if (destination.exists) destination.delete();
  destination.write(combined);
  return durationsMs;
}
