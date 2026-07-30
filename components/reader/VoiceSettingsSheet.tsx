import React, { useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import type * as SpeechModule from 'expo-speech';
import { Check } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getCachedVoices, prefetchVoices } from '@/services/speechEngine';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Heading, Label } from '@/components/ui/Typography';

const RATES = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

type Props = {
  visible: boolean;
  rate: number;
  onSelectRate: (rate: number) => void;
  voice: string | null;
  onSelectVoice: (voiceId: string | null) => void;
  onClose: () => void;
};

// Same plain-overlay pattern as TranslationSheet.tsx (not RN's <Modal>) — a separate
// native Window redraws the host window on open/close, which reads as the tab bar
// "flicking".
export function VoiceSettingsSheet({ visible, rate, onSelectRate, voice, onSelectVoice, onClose }: Props) {
  const theme = useTheme();
  // Seeded from cache so a second (or third, from a different reader screen) open of
  // this sheet in the same session shows the real voice list on the very first
  // frame — no re-fetch, no "loading" flash. Only the very first call anywhere in
  // the session actually waits on the native enumeration.
  const [voices, setVoices] = useState<SpeechModule.Voice[]>(() => getCachedVoices() ?? []);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  useEffect(() => {
    if (!visible || getCachedVoices()) return;
    let cancelled = false;
    prefetchVoices()
      .then((list) => {
        if (!cancelled) setVoices(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible]);

  // The on-device engine's own settings screen is where higher-quality offline voice
  // packs actually get installed (e.g. Android Settings > Accessibility > Text-to-
  // speech > Install voice data) — this list can only show what's already installed.
  const grouped = useMemo(() => {
    const byLanguage = new Map<string, SpeechModule.Voice[]>();
    for (const v of voices) {
      const list = byLanguage.get(v.language) ?? [];
      list.push(v);
      byLanguage.set(v.language, list);
    }
    return [...byLanguage.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [voices]);

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
            maxHeight: '75%',
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing.lg,
            paddingBottom: theme.spacing.xl,
          }}
        >
          <Heading style={{ fontSize: theme.fontSize.md, marginBottom: theme.spacing.sm }}>Read Aloud</Heading>

          <Label style={{ marginBottom: theme.spacing.xs }}>Speed</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, marginBottom: theme.spacing.md }}>
            {RATES.map((r) => {
              const isSelected = r === rate;
              return (
                <PressableScale key={r} onPress={() => onSelectRate(r)} scaleTo={0.95}>
                  <View
                    style={{
                      paddingVertical: theme.spacing.xs,
                      paddingHorizontal: theme.spacing.sm + 2,
                      borderRadius: theme.radius.pill,
                      borderWidth: 1,
                      borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                      backgroundColor: isSelected ? theme.colors.primarySoft : 'transparent',
                    }}
                  >
                    <Body style={{ fontSize: theme.fontSize.sm, color: isSelected ? theme.colors.primary : theme.colors.text }}>
                      {r}x
                    </Body>
                  </View>
                </PressableScale>
              );
            })}
          </View>

          <Label style={{ marginBottom: theme.spacing.xs }}>Voice</Label>
          <ScrollView style={{ marginBottom: theme.spacing.xs }}>
            <PressableScale
              onPress={() => onSelectVoice(null)}
              scaleTo={0.99}
              style={{ marginBottom: theme.spacing.xs }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: voice === null ? theme.colors.primary : theme.colors.border,
                  padding: theme.spacing.sm + 2,
                }}
              >
                <Body style={{ flex: 1, fontFamily: theme.fontFamily.sansSemiBold }}>System default</Body>
                {voice === null && <Check size={18} color={theme.colors.primary} />}
              </View>
            </PressableScale>

            {grouped.length === 0 && (
              <Body style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm, marginTop: theme.spacing.xs }}>
                No installed voices found — loading, or your device has none installed yet.
              </Body>
            )}

            {grouped.map(([language, list]) => (
              <View key={language} style={{ marginTop: theme.spacing.sm }}>
                <Label style={{ marginBottom: 4, color: theme.colors.textFaint }}>{language}</Label>
                {list.map((v) => {
                  const isSelected = v.identifier === voice;
                  return (
                    <PressableScale
                      key={v.identifier}
                      onPress={() => onSelectVoice(v.identifier)}
                      scaleTo={0.99}
                      style={{ marginBottom: theme.spacing.xs }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: theme.colors.surface,
                          borderRadius: theme.radius.md,
                          borderWidth: 1,
                          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                          padding: theme.spacing.sm + 2,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Body numberOfLines={1}>{v.name}</Body>
                          {/* Compared as a plain string rather than the SpeechModule.VoiceQuality enum
                              value — that enum is a real (not const) enum, so referencing its member
                              would need a runtime import of expo-speech here too, defeating the
                              deferred-require above just to read "Enhanced" vs "Default". */}
                          {String(v.quality) === 'Enhanced' && (
                            <Label style={{ color: theme.colors.textFaint }}>Enhanced</Label>
                          )}
                        </View>
                        {isSelected && <Check size={18} color={theme.colors.primary} />}
                      </View>
                    </PressableScale>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          <Label style={{ color: theme.colors.textFaint }}>
            For better offline voices, install voice data in your device's Text-to-Speech settings.
          </Label>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}
