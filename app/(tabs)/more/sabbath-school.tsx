import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { BookOpen, ChevronRight, Download, Grid3x3, ListChecks, Settings, Trash2 } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getKv, setKv } from '@/database/kv';
import {
  deleteQuarter,
  getDownloadedQuarters,
  SABBATH_EDITIONS,
  SABBATH_LANGUAGES,
  SabbathQuarterRow,
} from '@/database/sabbathSchool';
import { syncSabbathSchool, syncSpecificQuarter } from '@/services/sabbathSchoolSync';
import { showAlert } from '@/components/ui/AppAlert';
import { PressableScale } from '@/components/ui/PressableScale';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { Body, Heading, Label } from '@/components/ui/Typography';

const VIEW_MODE_KEY = 'sabbath_school_view_mode';

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale onPress={onPress} scaleTo={0.96}>
      <View
        style={{
          paddingHorizontal: theme.spacing.sm + 2,
          paddingVertical: theme.spacing.xs,
          borderRadius: theme.radius.pill,
          backgroundColor: active ? theme.colors.primary : theme.colors.surface,
          borderWidth: 1,
          borderColor: active ? theme.colors.primary : theme.colors.border,
          marginRight: theme.spacing.xs,
          marginBottom: theme.spacing.xs,
        }}
      >
        <Body style={{ color: active ? theme.colors.onPrimary : theme.colors.text, fontSize: theme.fontSize.sm }}>{label}</Body>
      </View>
    </PressableScale>
  );
}

// List view: small fixed thumbnail. Grid view: cover fills the full card width, the card's
// height grows to fit it (via aspect ratio) plus the title/label text underneath.
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

function CoverThumbFull({ uri }: { uri: string | null }) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View
        style={{
          width: '100%',
          aspectRatio: 3 / 4,
          borderRadius: theme.radius.sm,
          backgroundColor: theme.colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <BookOpen size={36} color={theme.colors.accent} strokeWidth={1.75} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      onError={() => setFailed(true)}
      style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceMuted }}
    />
  );
}

export default function SabbathSchoolScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const [quarters, setQuarters] = useState<SabbathQuarterRow[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lang, setLang] = useState(SABBATH_LANGUAGES[0].code);
  const [edition, setEdition] = useState(SABBATH_EDITIONS[0].code);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [settingsVisible, setSettingsVisible] = useState(false);

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

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <PressableScale onPress={() => setSettingsVisible(true)} style={{ padding: theme.spacing.xs }}>
            <Settings size={20} color={theme.colors.text} strokeWidth={1.75} />
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
  }, [navigation, theme, viewMode]);

  const refresh = useCallback(() => {
    getDownloadedQuarters(db).then(setQuarters);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleUpdate = async () => {
    setSyncing(true);
    const result = await syncSabbathSchool(db, { force: false });
    setSyncing(false);
    refresh();
    if (!result.synced) {
      showAlert('Up to date', 'No new quarter to download right now. Check your connection or try again later.');
    }
  };

  const handleDownloadVariant = async () => {
    if (lang === 'en' && edition === 'standard') return handleUpdate();
    setSyncing(true);
    const editionSuffix = SABBATH_EDITIONS.find((e) => e.code === edition)?.suffix ?? '';
    const result = await syncSpecificQuarter(db, lang, editionSuffix);
    setSyncing(false);
    refresh();
    if (!result.synced) {
      showAlert('Not available', "That language/edition isn't available yet. Check your connection or try again later.");
    } else {
      setSettingsVisible(false);
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

  const isDefaultVariant = lang === 'en' && edition === 'standard';

  const emptyState = (
    <Body style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing.lg }}>
      No lessons downloaded yet. Tap "Check for new lessons" below while online.
    </Body>
  );

  const list =
    viewMode === 'grid' ? (
      <FlatList
        key="grid"
        data={quarters}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: theme.spacing.md }}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl, gap: theme.spacing.md }}
        ListEmptyComponent={emptyState}
        renderItem={({ item }) => (
          <PressableScale
            onPress={() => router.push({ pathname: '/more/sabbath-school/[id]', params: { id: item.id } })}
            scaleTo={0.98}
            style={{ flex: 1 }}
          >
            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.border,
                padding: theme.spacing.sm,
              }}
            >
              <CoverThumbFull uri={item.cover} />
              <Body style={{ fontFamily: theme.fontFamily.sansSemiBold, marginTop: theme.spacing.sm }} numberOfLines={2}>
                {item.title}
              </Body>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                <Label numberOfLines={1} style={{ flex: 1 }}>
                  {SABBATH_LANGUAGES.find((l) => l.code === item.lang)?.label ?? item.lang}
                  {item.edition ? ` · ${SABBATH_EDITIONS.find((e) => e.suffix === item.edition)?.label ?? item.edition}` : ''}
                </Label>
                <PressableScale onPress={() => handleDelete(item.id, item.title)} style={{ padding: theme.spacing.xs }}>
                  <Trash2 size={16} color={theme.colors.danger} strokeWidth={1.75} />
                </PressableScale>
              </View>
            </View>
          </PressableScale>
        )}
      />
    ) : (
      <FlatList
        key="list"
        data={quarters}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        ListEmptyComponent={emptyState}
        renderItem={({ item }) => (
          <AnimatedCard style={{ marginBottom: theme.spacing.sm, padding: 0 }}>
            <PressableScale
              onPress={() => router.push({ pathname: '/more/sabbath-school/[id]', params: { id: item.id } })}
              scaleTo={0.99}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md }}>
                <CoverThumb uri={item.cover} width={48} height={64} />
                <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
                  <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }}>{item.title}</Body>
                  <Label style={{ marginTop: 2 }}>
                    {item.human_date} · {SABBATH_LANGUAGES.find((l) => l.code === item.lang)?.label ?? item.lang}
                    {item.edition ? ` · ${SABBATH_EDITIONS.find((e) => e.suffix === item.edition)?.label ?? item.edition}` : ''}
                  </Label>
                </View>
                <PressableScale onPress={() => handleDelete(item.id, item.title)} style={{ padding: theme.spacing.xs }}>
                  <Trash2 size={18} color={theme.colors.danger} strokeWidth={1.75} />
                </PressableScale>
                <ChevronRight size={16} color={theme.colors.textFaint} />
              </View>
            </PressableScale>
          </AnimatedCard>
        )}
      />
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      {list}

      <View
        style={{
          padding: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        }}
      >
        <PressableScale onPress={handleUpdate} scaleTo={0.98} disabled={syncing}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.primary,
              borderRadius: theme.radius.md,
              padding: theme.spacing.sm + 2,
              opacity: syncing ? 0.6 : 1,
            }}
          >
            <Download size={16} color={theme.colors.onPrimary} strokeWidth={2} />
            <Body style={{ color: theme.colors.onPrimary, fontFamily: theme.fontFamily.sansSemiBold, marginLeft: theme.spacing.xs }}>
              {syncing ? 'Checking…' : 'Check for new lessons'}
            </Body>
          </View>
        </PressableScale>
      </View>

      <Modal visible={settingsVisible} transparent animationType="fade" onRequestClose={() => setSettingsVisible(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setSettingsVisible(false)}>
          <Pressable
            style={{
              marginTop: 'auto',
              backgroundColor: theme.colors.background,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              padding: theme.spacing.lg,
              paddingBottom: theme.spacing.xl,
            }}
          >
            <Heading style={{ fontSize: theme.fontSize.md, marginBottom: theme.spacing.sm }}>Language & Edition</Heading>
            <Body style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.md, fontSize: theme.fontSize.sm }}>
              The standard English and chiShona editions download automatically when the app opens with a
              connection. Pick another language or the Easy Reading Edition to download it too.
            </Body>

            <Label style={{ marginBottom: theme.spacing.xs }}>Language</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.spacing.sm }}>
              {SABBATH_LANGUAGES.map((l) => (
                <Chip key={l.code} label={l.label} active={lang === l.code} onPress={() => setLang(l.code)} />
              ))}
            </View>

            <Label style={{ marginBottom: theme.spacing.xs }}>Edition</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.spacing.md }}>
              {SABBATH_EDITIONS.map((e) => (
                <Chip key={e.code} label={e.label} active={edition === e.code} onPress={() => setEdition(e.code)} />
              ))}
            </View>

            <PressableScale onPress={handleDownloadVariant} scaleTo={0.98} disabled={syncing}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.sm + 2,
                  opacity: syncing ? 0.6 : 1,
                }}
              >
                <Download size={16} color={theme.colors.onPrimary} strokeWidth={2} />
                <Body style={{ color: theme.colors.onPrimary, fontFamily: theme.fontFamily.sansSemiBold, marginLeft: theme.spacing.xs }}>
                  {syncing ? 'Checking…' : isDefaultVariant ? 'Check for new lessons' : 'Download this language/edition'}
                </Body>
              </View>
            </PressableScale>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
