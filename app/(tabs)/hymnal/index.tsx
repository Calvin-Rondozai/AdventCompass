import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { getKv } from '@/database/kv';
import { HYMNAL_LAST_LANGUAGE_KEY, HymnalLanguage } from '@/database/hymnal';
import { PageLoader } from '@/components/ui/PageLoader';

// The hymnal tab no longer has its own language-picker landing screen — it opens
// straight into whichever hymnal you read last (see HymnalLanguageSheet for switching),
// defaulting to English the first time.
export default function HymnalIndexRedirect() {
  const db = useSQLiteContext();

  useEffect(() => {
    let cancelled = false;
    getKv(db, HYMNAL_LAST_LANGUAGE_KEY).then((value) => {
      if (cancelled) return;
      const lang: HymnalLanguage = value === 'shona' || value === 'ndebele' ? value : 'english';
      router.replace({ pathname: '/hymnal/[language]', params: { language: lang } });
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  return <PageLoader />;
}
