export type OffertoryReference = {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
  comment: string;
};

export const OFFERTORY_REFERENCES: OffertoryReference[] = [
  {
    book: 'Leviticus', chapter: 22, verseStart: 29,
    comment: 'An offering brought "at your own will" is to be given willingly, not grudgingly, the attitude of the giver matters as much to God as the gift itself.',
  },
  {
    book: 'Deuteronomy', chapter: 16, verseStart: 17,
    comment: 'Giving is proportional, not identical: "according to the blessing of the Lord your God which He has given you." God asks in proportion to what He has already provided, never more.',
  },
  {
    book: 'Psalms', chapter: 24, verseStart: 1,
    comment: 'Before any appeal for giving comes this foundation: everything already belongs to God. What we return in tithes and offerings was never fully ours to begin with; we are stewards, not owners.',
  },
  {
    book: 'Psalms', chapter: 96, verseStart: 7,
    comment: 'Bringing an offering is placed alongside ascribing God glory and strength; giving is an act of worship, not merely a financial transaction.',
  },
  {
    book: 'Proverbs', chapter: 29, verseStart: 18,
    comment: 'Where there is no vision (no clear sense of God\'s mission), people (and their giving) drift. Supporting the church\'s work keeps that vision, and our part in it, alive.',
  },
  {
    book: 'Proverbs', chapter: 3, verseStart: 9, verseEnd: 10,
    comment: 'Honoring God with the "firstfruits," not the leftovers, reverses the usual order; God is provided for first, and the promise attached is abundance, not lack.',
  },
  {
    book: 'Haggai', chapter: 2, verseStart: 8,
    comment: '"The silver is Mine, and the gold is Mine", a direct reminder that God does not need our money for His sake; He invites our giving for the sake of our own hearts and His work.',
  },
  {
    book: 'Malachi', chapter: 3, verseStart: 10,
    comment: 'The only place in Scripture where God says "test Me", tied specifically to bringing the whole tithe. Faithful giving is met with a promised blessing "poured out" beyond capacity to contain.',
  },
  {
    book: 'Matthew', chapter: 6, verseStart: 20, verseEnd: 21,
    comment: 'Treasure in heaven cannot rust or be stolen. Jesus ties the heart directly to where treasure is placed; giving toward God\'s work is one way of relocating the heart itself.',
  },
  {
    book: 'Luke', chapter: 21, verseStart: 3, verseEnd: 4,
    comment: 'The widow\'s two small coins outweighed the large gifts of the wealthy in Christ\'s eyes, because she gave "all her livelihood." God measures giving by sacrifice and trust, not by amount.',
  },
  {
    book: 'John', chapter: 3, verseStart: 16,
    comment: 'The pattern for all Christian giving: God so loved that He gave His only Son. Every offering we bring is a small echo of the ultimate gift already given to us.',
  },
  {
    book: '2 Corinthians', chapter: 9, verseStart: 7,
    comment: 'Not "grudgingly, or of necessity"; the manner of giving matters as much as the measure. "God loves a cheerful giver," one who gives freely because the heart has already decided.',
  },
  {
    book: '2 Corinthians', chapter: 8, verseStart: 12,
    comment: 'God accepts a gift "according to what one has," not according to what one lacks. Willingness, not wealth, is the measure of an acceptable offering.',
  },
  {
    book: 'Ephesians', chapter: 2, verseStart: 10,
    comment: 'We are God\'s "workmanship, created... for good works", giving is one of the good works He has already prepared for us to walk in, part of the purpose of the new life in Christ.',
  },
  {
    book: 'James', chapter: 1, verseStart: 17,
    comment: 'Every good gift comes down "from the Father of lights," who does not change. Our giving is simply a grateful response, returning a portion of what was always a gift from Him first.',
  },
  {
    book: 'Psalms', chapter: 116, verseStart: 12,
    comment: '"What shall I render to the Lord for all His benefits toward me?" Giving flows from gratitude for what God has already done; it is a response to grace, not a payment for it.',
  },
];

export function formatOffertoryRef(ref: OffertoryReference): string {
  return ref.verseEnd ? `${ref.book} ${ref.chapter}:${ref.verseStart}-${ref.verseEnd}` : `${ref.book} ${ref.chapter}:${ref.verseStart}`;
}

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start;
  return Math.floor(diff / 86_400_000);
}

export function getOffertoryReferenceOfDay(date: Date = new Date()): OffertoryReference {
  return OFFERTORY_REFERENCES[dayOfYear(date) % OFFERTORY_REFERENCES.length];
}
