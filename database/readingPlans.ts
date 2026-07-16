export type ReadingPlanDay = { day: number; book: string; chapters: number[] };
export type ReadingPlan = { id: string; title: string; description: string; days: ReadingPlanDay[] };

export function buildSequentialPlan(book: string, totalChapters: number, numDays: number): ReadingPlanDay[] {
  const perDay = totalChapters / numDays;
  const days: ReadingPlanDay[] = [];
  let chapter = 1;
  for (let day = 1; day <= numDays; day++) {
    const count = Math.round(day * perDay) - Math.round((day - 1) * perDay);
    const chapters = Array.from({ length: count }, (_, i) => chapter + i);
    chapter += count;
    days.push({ day, book, chapters });
  }
  return days;
}

export function buildRangePlan(book: string, startChapter: number, endChapter: number, numDays: number): ReadingPlanDay[] {
  const perDay = (endChapter - startChapter + 1) / numDays;
  const days: ReadingPlanDay[] = [];
  let chapter = startChapter;
  for (let day = 1; day <= numDays; day++) {
    const count = Math.round(day * perDay) - Math.round((day - 1) * perDay);
    const chapters = Array.from({ length: count }, (_, i) => chapter + i);
    chapter += count;
    days.push({ day, book, chapters });
  }
  return days;
}

export const READING_PLANS: ReadingPlan[] = [
  {
    id: 'john-21',
    title: 'Gospel of John in 21 Days',
    description: 'One chapter a day through the life of Christ as told by John.',
    days: buildSequentialPlan('John', 21, 21),
  },
  {
    id: 'psalms-30',
    title: 'Psalms in 30 Days',
    description: 'Five psalms a day through the whole book of Psalms.',
    days: buildSequentialPlan('Psalms', 150, 30),
  },
  {
    id: 'proverbs-31',
    title: 'Proverbs in a Month',
    description: 'One chapter of Proverbs a day, wisdom for every day of the month.',
    days: buildSequentialPlan('Proverbs', 31, 31),
  },
];

export function getReadingPlan(id: string): ReadingPlan | undefined {
  return READING_PLANS.find((p) => p.id === id);
}
