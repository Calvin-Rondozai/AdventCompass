import React, { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Delete, Grid3x3 } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getHymn, HymnalLanguage } from '@/database/hymnal';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Heading } from '@/components/ui/Typography';

const DIAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

type Props = { language: HymnalLanguage; replaceNavigation?: boolean };

export function HymnNumberJump({ language, replaceNavigation }: Props) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const [numberInput, setNumberInput] = useState('');
  const [error, setError] = useState(false);

  const handleJump = (num: number) => {
    const target = getHymn(language, num);
    if (!target) {
      setError(true);
      return;
    }
    setVisible(false);
    setNumberInput('');
    setError(false);
    const dest = { pathname: '/more/hymnal/[language]/[number]' as const, params: { language, number: String(num) } };
    if (replaceNavigation) router.replace(dest);
    else router.push(dest);
  };

  const pressKey = (key: string) => {
    setError(false);
    if (key === 'del') {
      setNumberInput((prev) => prev.slice(0, -1));
    } else if (numberInput.length < 3) {
      setNumberInput((prev) => prev + key);
    }
  };

  return (
    <>
      <PressableScale
        onPress={() => setVisible(true)}
        style={{ position: 'absolute', right: theme.spacing.lg, bottom: theme.spacing.xxl + theme.spacing.lg }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            ...theme.shadow.floating,
          }}
        >
          <Grid3x3 size={24} color={theme.colors.onPrimary} strokeWidth={2.2} />
        </View>
      </PressableScale>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
          onPress={() => setVisible(false)}
        >
          <Pressable
            style={{
              marginTop: 'auto',
              backgroundColor: theme.colors.background,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              padding: theme.spacing.lg,
              paddingBottom: theme.spacing.xl,
              gap: theme.spacing.sm,
            }}
          >
            <Heading style={{ fontSize: theme.fontSize.md }}>Go to hymn number</Heading>

            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: error ? theme.colors.danger : theme.colors.border,
                paddingVertical: theme.spacing.sm + 4,
              }}
            >
              <Heading style={{ fontSize: theme.fontSize.xl }}>{numberInput || '·'}</Heading>
            </View>
            {error && (
              <Body style={{ color: theme.colors.danger, fontSize: theme.fontSize.sm }}>
                No hymn {numberInput} in this hymnal.
              </Body>
            )}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {DIAL_KEYS.map((key, i) => (
                <View key={i} style={{ width: '33.33%', padding: 4 }}>
                  {key === '' ? (
                    <View style={{ height: 48 }} />
                  ) : (
                    <PressableScale onPress={() => pressKey(key)} scaleTo={0.92}>
                      <View
                        style={{
                          height: 48,
                          borderRadius: theme.radius.md,
                          backgroundColor: theme.colors.surfaceMuted,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {key === 'del' ? (
                          <Delete size={18} color={theme.colors.textMuted} strokeWidth={1.75} />
                        ) : (
                          <Heading style={{ fontSize: theme.fontSize.lg }}>{key}</Heading>
                        )}
                      </View>
                    </PressableScale>
                  )}
                </View>
              ))}
            </View>

            <PressableScale onPress={() => numberInput && handleJump(Number(numberInput))} scaleTo={0.98}>
              <View
                style={{
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.sm + 2,
                  alignItems: 'center',
                }}
              >
                <Body style={{ color: theme.colors.onPrimary, fontFamily: theme.fontFamily.sansSemiBold }}>Go</Body>
              </View>
            </PressableScale>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
