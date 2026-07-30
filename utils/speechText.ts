import type { ReadAloudChunk } from '@/hooks/useReadAloud';

// Android's TextToSpeech silently truncates (or errors on some OEM engines) past
// roughly 4000 characters per utterance — most compilation-book paragraphs are
// nowhere near that, but a few run long. Stay well under the limit and split on
// sentence boundaries rather than mid-word.
const MAX_CHUNK_LENGTH = 3800;

// Multiple returned chunks intentionally share the same `key` — useReadAloud's
// activeKey highlight then keeps tracking the same paragraph/entry across its own
// sub-chunks instead of jumping to a "next" that doesn't exist yet.
export function splitForSpeech(key: string, text: string): ReadAloudChunk[] {
  if (text.length <= MAX_CHUNK_LENGTH) return [{ key, text }];
  const sentences = text.split(/(?<=[.!?])\s+/);
  const out: ReadAloudChunk[] = [];
  let buf = '';
  for (const sentence of sentences) {
    const candidate = buf ? `${buf} ${sentence}` : sentence;
    if (candidate.length > MAX_CHUNK_LENGTH && buf) {
      out.push({ key, text: buf });
      buf = sentence;
    } else {
      buf = candidate;
    }
  }
  if (buf) out.push({ key, text: buf });
  return out;
}

// EGW paragraphs keep scraped page markers ("[123]") and print-style em-dash
// sub-headings ("The Child's First Textbook--The Bible should be...") in their raw
// text for on-screen rendering (see renderPageMarkers/renderParagraph in the EGW
// reader) — neither reads naturally aloud, so strip/soften them for speech only.
export function speechTextForEgwParagraph(text: string): string {
  return text
    .replace(/\[\d+\]/g, '')
    .replace(/--/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}
