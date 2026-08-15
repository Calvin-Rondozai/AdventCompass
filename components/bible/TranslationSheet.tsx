import React, { useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Check } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { BIBLE_TRANSLATIONS } from '@/database/translations';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Heading } from '@/components/ui/Typography';

type Props = {
  visible: boolean;
  selected: string;
  onSelect: (code: string) => void;
  onClose: () => void;
};

// Plain overlay instead of RN's <Modal> — see VersePopup.tsx for why: Modal's separate
// native Android Window causes a host-window redraw (visible as the bottom tab bar
// "flicking") whenever it opens/closes.
export function TranslationSheet({ visible, selected, onSelect, onClose }: Props) {
  const theme = useTheme();

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 1000 }]}
    >
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose}>
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
          <Heading style={{ fontSize: theme.fontSize.md, marginBottom: theme.spacing.sm }}>Bible Version</Heading>
          {BIBLE_TRANSLATIONS.map((item) => {
            const isSelected = item.code === selected;
            return (
              <PressableScale
                key={item.code}
                onPress={() => {
                  onSelect(item.code);
                  onClose();
                }}
                scaleTo={0.99}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: theme.spacing.sm + 2,
                    gap: theme.spacing.xs,
                  }}
                >
                  <View style={{ width: 18, alignItems: 'center' }}>
                    {isSelected && <Check size={18} color={theme.colors.primary} />}
                  </View>
                  <Body
                    style={{
                      fontFamily: theme.fontFamily.sansSemiBold,
                      color: isSelected ? theme.colors.primary : theme.colors.text,
                    }}
                  >
                    {item.code}: {item.name}
                  </Body>
                </View>
              </PressableScale>
            );
          })}
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}
