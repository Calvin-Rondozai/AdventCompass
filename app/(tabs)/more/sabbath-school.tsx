import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { BookOpen, ChevronRight, Download, Grid3x3, ListChecks, RefreshCw, Trash2 } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getKv, setKv } from '@/database/kv';
import {
  deleteQuarter,
  getDownloadedQuarters,
  SABBATH_AGE_DIVISIONS,
  SABBATH_EDITIONS,
  SABBATH_LANGUAGES,
  SabbathAgeDivision,
  SabbathQuarterRow,
} from '@/database/sabbathSchool';
import { getDownloadedPdfLessons, SabbathPdfLesson } from '@/database/sabbathPdfLessons';
import {
  getActiveSabbathSyncTask,
  getSabbathSyncProgress,
  guessCoverUrl,
  isSyncingSabbathSchool,
  subscribeSabbathSync,
  SyncProgress,
  syncSabbathSchool,
  syncSpecificQuarter,
} from '@/services/sabbathSchoolSync';
import {
  deletePdfLessonAndFiles,
  getActivePdfSyncTask,
  getPdfSyncProgress,
  getSyncingPdfDivision,
  isSyncingPdfLesson,
  PdfSyncProgress,
  subscribePdfSync,
  syncPdfDivision,
} from '@/services/sabbathPdfSync';
import { showAlert } from '@/components/ui/AppAlert';
import { PressableScale } from '@/components/ui/PressableScale';
import { CoverThumbFull } from '@/components/sabbathSchool/CoverThumbFull';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Body, Label } from '@/components/ui/Typography';

const VIEW_MODE_KEY = 'sabbath_school_view_mode';
// The specialized age divisions (everything besides Standard/Easy Reading) are browsed and
// downloaded in English only for now — same simplification as the rest of this feature,
// see SABBATH_AGE_DIVISIONS in database/sabbathSchool.ts.
const LIBRARY_LANG = 'en';

function divisionLabel(suffix: string): string {
  return SABBATH_AGE_DIVISIONS.find((d) => d.suffix === suffix)?.label ?? suffix;
}

// List view's small fixed thumbnail (grid view uses the shared full-bleed CoverThumbFull).
function CoverThumb({ uri, width, height }: { uri: string | null; width: number; height: number }) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View
        style={{
          width,
          height,
          borderRadius: theme.radius.sm,
          backgroundColor: theme.colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <BookOpen size={Math.round(Math.min(width, height) * 0.35)} color={theme.colors.accent} strokeWidth={1.75} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      onError={() => setFailed(true)}
      style={{ width, height, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceMuted }}
    />
  );
}

// A tile is a downloaded text quarter, a downloaded PDF-format lesson set, or an age
// division that hasn't been downloaded yet — all rendered side by side in the same grid/
// list so every book, downloaded or not, text or PDF, looks and behaves the same way.
type GridItem =
  | { kind: 'downloaded'; id: string; row: SabbathQuarterRow }
  | { kind: 'downloadedPdf'; id: string; lesson: SabbathPdfLesson }
  | { kind: 'available'; id: string; division: SabbathAgeDivision };

export default function SabbathSchoolScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const [quarters, setQuarters] = useState<SabbathQuarterRow[]>([]);
  const [pdfLessons, setPdfLessons] = useState<SabbathPdfLesson[]>([]);
  // Seeded from module-level state (not just false) so re-opening this screen while a
  // download kicked off earlier is still in flight shows it as already running, with
  // real progress, instead of a blank "Check for new lessons" button.
  const [textSyncing, setTextSyncing] = useState(isSyncingSabbathSchool());
  const [textProgress, setTextProgress] = useState<SyncProgress | null>(getSabbathSyncProgress());
  const [downloadingTextSuffix, setDownloadingTextSuffix] = useState<string | null>(null);
  const [pdfSyncing, setPdfSyncing] = useState(isSyncingPdfLesson());
  const [pdfProgress, setPdfProgress] = useState<PdfSyncProgress | null>(getPdfSyncProgress());
  const [pdfSyncingDivision, setPdfSyncingDivision] = useState<string | null>(getSyncingPdfDivision());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const refresh = useCallback(() => {
    getDownloadedQuarters(db).then(setQuarters);
    getDownloadedPdfLessons(db).then(setPdfLessons);
  }, [db]);

  // The text-lesson download itself is a module-level singleton (see sabbathSchoolSync.ts)
  // that keeps running even if this screen unmounts — this just mirrors its live state so
  // the UI reflects whatever's actually happening, whether this screen started the
  // download or is just re-observing one already in progress.
  useEffect(() => {
    const unsubscribe = subscribeSabbathSync((p) => {
      setTextProgress(p);
      const active = isSyncingSabbathSchool();
      setTextSyncing(active);
      if (!active) setDownloadingTextSuffix(null);
    });
    const active = getActiveSabbathSyncTask();
    if (active) active.then(() => refresh());
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same idea, for the separate PDF-division singleton (see services/sabbathPdfSync.ts) —
  // kept independent of the text one above so a PDF division download and a text-quarter
  // check can proceed at the same time without either blocking the other.
  useEffect(() => {
    const unsubscribe = subscribePdfSync((p) => {
      setPdfProgress(p);
      const active = isSyncingPdfLesson();
      setPdfSyncing(active);
      setPdfSyncingDivision(active ? getSyncingPdfDivision() : null);
    });
    const active = getActivePdfSyncTask();
    if (active) active.then(() => refresh());
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getKv(db, VIEW_MODE_KEY).then((v) => {
      if (v === 'grid' || v === 'list') setViewMode(v);
    });
  }, [db]);

  const toggleViewMode = () => {
    const next = viewMode === 'grid' ? 'list' : 'grid';
    setViewMode(next);
    setKv(db, VIEW_MODE_KEY, next).catch(() => {});
  };

  const checkingForUpdates = textSyncing && !downloadingTextSuffix;

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <PressableScale onPress={handleCheckForUpdates} disabled={textSyncing} style={{ padding: theme.spacing.xs }}>
            {checkingForUpdates ? (
              <ActivityIndicator size="small" color={theme.colors.text} />
            ) : (
              <RefreshCw size={20} color={theme.colors.text} strokeWidth={1.75} />
            )}
          </PressableScale>
          <PressableScale onPress={toggleViewMode} style={{ padding: theme.spacing.xs }}>
            {viewMode === 'grid' ? (
              <ListChecks size={20} color={theme.colors.text} strokeWidth={1.75} />
            ) : (
              <Grid3x3 size={20} color={theme.colors.text} strokeWidth={1.75} />
            )}
          </PressableScale>
        </View>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, theme, viewMode, textSyncing, checkingForUpdates]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Manual only — checking every time the screen opens made the UI feel sluggish, so this
  // now runs solely from the header refresh button. syncSabbathSchool is a module-level
  // singleton (see sabbathSchoolSync.ts), so this is a no-op if a division download below
  // (or the app-launch sync) is already running rather than starting a duplicate.
  const handleCheckForUpdates = async () => {
    if (textSyncing) return;
    setTextSyncing(true);
    const result = await syncSabbathSchool(db, { force: false });
    refresh();
    if (!result.synced) {
      showAlert('Up to date', 'No new quarter to download right now. Check your connection or try again later.');
    }
  };

  const handleDownloadDivision = async (division: SabbathAgeDivision) => {
    if (division.format === 'text') {
      if (textSyncing) return;
      setDownloadingTextSuffix(division.suffix);
      setTextSyncing(true);
      const result = await syncSpecificQuarter(db, LIBRARY_LANG, division.suffix);
      refresh();
      if (!result.synced) {
        showAlert('Not available', `"${division.label}" isn't available yet. Check your connection or try again later.`);
      }
    } else {
      if (pdfSyncing) return;
      setPdfSyncingDivision(division.suffix);
      setPdfSyncing(true);
      const result = await syncPdfDivision(db, division.suffix);
      refresh();
      if (!result.synced) {
        showAlert('Not available', `"${division.label}" isn't available yet. Check your connection or try again later.`);
      }
    }
  };

  const handleDelete = (id: string, title: string) => {
    showAlert('Delete quarter', `Remove "${title}" from this device? You can download it again later.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteQuarter(db, id);
          refresh();
        },
      },
    ]);
  };

  const handleDeletePdfLesson = (lesson: SabbathPdfLesson) => {
    showAlert('Delete lesson set', `Remove "${lesson.title}" from this device? You can download it again later.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deletePdfLessonAndFiles(db, lesson.id, lesson.division, lesson.code);
          refresh();
        },
      },
    ]);
  };

  // Every division not already downloaded (in the library language) shows up as its own
  // tile right alongside the real lessons — no separate "browse" screen needed.
  const availableDivisions = useMemo(() => {
    const downloadedText = new Set(quarters.filter((q) => q.lang === LIBRARY_LANG).map((q) => q.edition));
    const downloadedPdf = new Set(pdfLessons.map((p) => p.division));
    return SABBATH_AGE_DIVISIONS.filter((d) => (d.format === 'text' ? !downloadedText.has(d.suffix) : !downloadedPdf.has(d.suffix)));
  }, [quarters, pdfLessons]);

  const data: GridItem[] = useMemo(
    () => [
      ...quarters.map((row): GridItem => ({ kind: 'downloaded', id: row.id, row })),
      ...pdfLessons.map((lesson): GridItem => ({ kind: 'downloadedPdf', id: `pdf:${lesson.id}`, lesson })),
      ...availableDivisions.map((division): GridItem => ({ kind: 'available', id: `available:${division.suffix}`, division })),
    ],
    [quarters, pdfLessons, availableDivisions]
  );

  const emptyState = (
    <Body style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing.lg }}>
      No lessons downloaded yet. Tap "Check for new lessons" below while online.
    </Body>
  );

  const list =
    viewMode === 'grid' ? (
      <FlatList
        key="grid"
        data={data}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: theme.spacing.md }}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl, gap: theme.spacing.md }}
        ListEmptyComponent={emptyState}
        renderItem={({ item }) => {
          if (item.kind === 'downloaded') {
            const row = item.row;
            return (
              <PressableScale
                onPress={() => router.push({ pathname: '/more/sabbath-school/[id]', params: { id: row.id } })}
                scaleTo={0.98}
                style={{ flex: 1 }}
              >
                <View
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radius.lg,
                    padding: theme.spacing.sm,
                    ...theme.shadow.subtle,
                  }}
                >
                  <CoverThumbFull uri={row.cover} />
                  <Body style={{ fontFamily: theme.fontFamily.sansSemiBold, marginTop: theme.spacing.sm }} numberOfLines={2}>
                    {row.title}
                  </Body>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                    <Label numberOfLines={1} style={{ flex: 1 }}>
                      {SABBATH_LANGUAGES.find((l) => l.code === row.lang)?.label ?? row.lang}
                      {row.edition ? ` · ${SABBATH_EDITIONS.find((e) => e.suffix === row.edition)?.label ?? row.edition}` : ''}
                    </Label>
                    <PressableScale onPress={() => handleDelete(row.id, row.title)} style={{ padding: theme.spacing.xs }}>
                      <Trash2 size={16} color={theme.colors.danger} strokeWidth={1.75} />
                    </PressableScale>
                  </View>
                </View>
              </PressableScale>
            );
          }

          if (item.kind === 'downloadedPdf') {
            const lesson = item.lesson;
            return (
              <PressableScale
                onPress={() => router.push({ pathname: '/more/sabbath-school/pdf/[id]', params: { id: lesson.id } })}
                scaleTo={0.98}
                style={{ flex: 1 }}
              >
                <View
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radius.lg,
                    padding: theme.spacing.sm,
                    ...theme.shadow.subtle,
                  }}
                >
                  <CoverThumbFull uri={guessCoverUrl(LIBRARY_LANG, lesson.division, lesson.code)} />
                  <Body style={{ fontFamily: theme.fontFamily.sansSemiBold, marginTop: theme.spacing.sm }} numberOfLines={2}>
                    {lesson.title}
                  </Body>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                    <Label numberOfLines={1} style={{ flex: 1 }}>
                      {divisionLabel(lesson.division)} · PDF
                    </Label>
                    <PressableScale onPress={() => handleDeletePdfLesson(lesson)} style={{ padding: theme.spacing.xs }}>
                      <Trash2 size={16} color={theme.colors.danger} strokeWidth={1.75} />
                    </PressableScale>
                  </View>
                </View>
              </PressableScale>
            );
          }

          const division = item.division;
          const isDownloadingThis =
            division.format === 'text'
              ? textSyncing && downloadingTextSuffix === division.suffix
              : pdfSyncing && pdfSyncingDivision === division.suffix;
          const isBusyElsewhere =
            division.format === 'text'
              ? textSyncing && downloadingTextSuffix !== division.suffix
              : pdfSyncing && pdfSyncingDivision !== division.suffix;
          const activeProgress = division.format === 'text' ? textProgress : pdfProgress;
          return (
            <PressableScale
              onPress={() => handleDownloadDivision(division)}
              scaleTo={0.98}
              style={{ flex: 1 }}
              disabled={isBusyElsewhere}
            >
              <View
                style={{
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radius.lg,
                  padding: theme.spacing.sm,
                  opacity: isBusyElsewhere ? 0.5 : 1,
                  ...theme.shadow.subtle,
                }}
              >
                <CoverThumbFull uri={guessCoverUrl(LIBRARY_LANG, division.suffix)} />
                <Body style={{ fontFamily: theme.fontFamily.sansSemiBold, marginTop: theme.spacing.sm }} numberOfLines={2}>
                  {division.label}
                </Body>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                  <Label numberOfLines={1} style={{ flex: 1, color: isDownloadingThis ? theme.colors.primary : undefined }}>
                    {isDownloadingThis ? (activeProgress?.label ?? 'Starting download…') : division.ageGroup}
                  </Label>
                  {isDownloadingThis ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <Download size={16} color={theme.colors.primary} strokeWidth={2} />
                  )}
                </View>
                {isDownloadingThis && (
                  <View style={{ marginTop: theme.spacing.xs }}>
                    <ProgressBar
                      progress={activeProgress && activeProgress.total > 0 ? activeProgress.current / activeProgress.total : 0}
                      color={theme.colors.primary}
                      trackColor={theme.colors.surfaceMuted}
                    />
                  </View>
                )}
              </View>
            </PressableScale>
          );
        }}
      />
    ) : (
      <FlatList
        key="list"
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        ListEmptyComponent={emptyState}
        renderItem={({ item, index }) => {
          const rowStyle = {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            paddingVertical: theme.spacing.sm + 2,
            borderBottomWidth: index === data.length - 1 ? 0 : 1,
            borderBottomColor: theme.colors.border,
          };

          if (item.kind === 'downloaded') {
            const row = item.row;
            return (
              <PressableScale
                onPress={() => router.push({ pathname: '/more/sabbath-school/[id]', params: { id: row.id } })}
                scaleTo={0.99}
              >
                <View style={rowStyle}>
                  <CoverThumb uri={row.cover} width={48} height={64} />
                  <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
                    <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }}>{row.title}</Body>
                    <Label style={{ marginTop: 2 }}>
                      {row.human_date} · {SABBATH_LANGUAGES.find((l) => l.code === row.lang)?.label ?? row.lang}
                      {row.edition ? ` · ${SABBATH_EDITIONS.find((e) => e.suffix === row.edition)?.label ?? row.edition}` : ''}
                    </Label>
                  </View>
                  <PressableScale onPress={() => handleDelete(row.id, row.title)} style={{ padding: theme.spacing.xs }}>
                    <Trash2 size={18} color={theme.colors.danger} strokeWidth={1.75} />
                  </PressableScale>
                  <ChevronRight size={16} color={theme.colors.textFaint} />
                </View>
              </PressableScale>
            );
          }

          if (item.kind === 'downloadedPdf') {
            const lesson = item.lesson;
            return (
              <PressableScale
                onPress={() => router.push({ pathname: '/more/sabbath-school/pdf/[id]', params: { id: lesson.id } })}
                scaleTo={0.99}
              >
                <View style={rowStyle}>
                  <CoverThumb uri={guessCoverUrl(LIBRARY_LANG, lesson.division, lesson.code)} width={48} height={64} />
                  <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
                    <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }}>{lesson.title}</Body>
                    <Label style={{ marginTop: 2 }}>
                      {lesson.humanDate} · {divisionLabel(lesson.division)} · PDF
                    </Label>
                  </View>
                  <PressableScale onPress={() => handleDeletePdfLesson(lesson)} style={{ padding: theme.spacing.xs }}>
                    <Trash2 size={18} color={theme.colors.danger} strokeWidth={1.75} />
                  </PressableScale>
                  <ChevronRight size={16} color={theme.colors.textFaint} />
                </View>
              </PressableScale>
            );
          }

          const division = item.division;
          const isDownloadingThis =
            division.format === 'text'
              ? textSyncing && downloadingTextSuffix === division.suffix
              : pdfSyncing && pdfSyncingDivision === division.suffix;
          const isBusyElsewhere =
            division.format === 'text'
              ? textSyncing && downloadingTextSuffix !== division.suffix
              : pdfSyncing && pdfSyncingDivision !== division.suffix;
          const activeProgress = division.format === 'text' ? textProgress : pdfProgress;
          return (
            <PressableScale
              onPress={() => handleDownloadDivision(division)}
              scaleTo={0.99}
              disabled={isBusyElsewhere}
              style={{ opacity: isBusyElsewhere ? 0.5 : 1 }}
            >
              <View style={rowStyle}>
                <CoverThumb uri={guessCoverUrl(LIBRARY_LANG, division.suffix)} width={48} height={64} />
                <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
                  <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }}>{division.label}</Body>
                  <Label style={{ marginTop: 2, color: isDownloadingThis ? theme.colors.primary : undefined }} numberOfLines={1}>
                    {isDownloadingThis ? (activeProgress?.label ?? 'Starting download…') : `${division.ageGroup} · ${division.description}`}
                  </Label>
                  {isDownloadingThis && (
                    <View style={{ marginTop: theme.spacing.xs }}>
                      <ProgressBar
                        progress={activeProgress && activeProgress.total > 0 ? activeProgress.current / activeProgress.total : 0}
                        color={theme.colors.primary}
                        trackColor={theme.colors.surfaceMuted}
                      />
                    </View>
                  )}
                </View>
                {isDownloadingThis ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <Download size={18} color={theme.colors.primary} strokeWidth={2} />
                )}
              </View>
            </PressableScale>
          );
        }}
      />
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      {checkingForUpdates && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: theme.spacing.xs }}>
          <ActivityIndicator size="small" color={theme.colors.textFaint} />
          <Label style={{ marginLeft: theme.spacing.xs }}>Checking for new lessons…</Label>
        </View>
      )}
      {list}
    </SafeAreaView>
  );
}
