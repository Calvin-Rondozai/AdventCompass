import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { getVerseFromPlan, getVerseOfDay, Verse } from '@/database/bible';
import { getActiveReadingPlanId } from '@/database/activeReadingPlan';
import { findAnyPlan } from '@/database/customReadingPlans';
import { useBibleTranslation } from '@/hooks/useBibleTranslation';

// useFocusEffect (not a plain effect) so picking a different reading plan as the daily-
// verse source on the Reading Plans screen is reflected the moment the Home tab regains
// focus, instead of only on the next cold mount.
export function useDailyVerse() {
  const db = useSQLiteContext();
  const { translation } = useBibleTranslation();
  const [verse, setVerse] = useState<Verse | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const planId = await getActiveReadingPlanId(db);
        const plan = planId ? await findAnyPlan(db, planId) : undefined;
        const v = plan ? await getVerseFromPlan(db, translation, plan) : await getVerseOfDay(db, translation);
        if (!cancelled) setVerse(v);
      })();
      return () => {
        cancelled = true;
      };
    }, [db, translation])
  );

  return verse;
}
