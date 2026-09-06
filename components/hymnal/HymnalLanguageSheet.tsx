import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Check, ChevronRight, Heart, Music } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { HYMNALS, HymnalLanguage } from '@/database/hymnal';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Heading, Label } from '@/components/ui/Typography';

export type HymnalLanguageSheetHandle = { open: () => void };

type Props = {
  currentLanguage?: HymnalLanguage;
  // Detail screen: switching language keeps the same hymn number (numbers are synced
  // across every translation of this hymnal). List screen: omit this, it just opens
  // that language's hymn list from the top.
  hymnNumber?: number;
};

export const HymnalLanguageSheet = forwardRef<HymnalLanguageSheetHandle, Props>(function HymnalLanguageSheet(
  { currentLanguage, hymnNumber },
  ref
) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);

  useImperativeHandle(ref, () => ({ open: () => setVisible(true) }), []);

  const goToLanguage = (lang: HymnalLanguage) => {
    setVisible(false);
    if (hymnNumber) {
      router.replace({ pathname: '/hymnal/[language]/[number]', params: { language: lang, number: String(hymnNumber) } });
    } else {
      router.push({ pathname: '/hymnal/[language]', params: { language: lang } });
    }
  };

  const goToFavorites = () => {
    setVisible(false);
    router.push('/hymnal/favorites');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setVisible(false)}>
        <Pressable
          style={{
            marginTop: 'auto',
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing.xl,
          }}
        >
          <Heading style={{ fontSize: theme.fontSize.md, paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.sm }}>
            Hymnal language
          </Heading>

          <PressableScale onPress={goToFavorites} scaleTo={0.99}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: theme.spacing.md,
                paddingHorizontal: theme.spacing.lg,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <Heart size={22} color={theme.colors.danger} fill={theme.colors.danger} strokeWidth={1.75} />
              <Body style={{ flex: 1, marginLeft: theme.spacing.md, fontFamily: theme.fontFamily.sansSemiBold }}>Favorites</Body>
              <ChevronRight size={16} color={theme.colors.textFaint} />
            </View>
          </PressableScale>

          {HYMNALS.map((hymnal, i) => {
            const active = hymnal.code === currentLanguage;
            return (
              <PressableScale key={hymnal.code} onPress={() => goToLanguage(hymnal.code)} scaleTo={0.99}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: theme.spacing.md,
                    paddingHorizontal: theme.spacing.lg,
                    borderBottomWidth: i === HYMNALS.length - 1 ? 0 : 1,
                    borderBottomColor: theme.colors.border,
                  }}
                >
                  <Music size={22} color={active ? theme.colors.primary : theme.colors.textFaint} strokeWidth={1.75} />
                  <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                    <Body style={{ fontFamily: active ? theme.fontFamily.sansSemiBold : theme.fontFamily.sansMedium }}>
                      {hymnal.label}
                    </Body>
                    <Label style={{ marginTop: 2 }}>{hymnal.source}</Label>
                  </View>
                  {active && <Check size={18} color={theme.colors.primary} />}
                </View>
              </PressableScale>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
});
