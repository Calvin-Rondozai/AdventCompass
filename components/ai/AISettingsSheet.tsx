import React, { useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Download, FolderOpen, Info, Trash2 } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import type { ActiveModelInfo, DownloadProgress } from '@/services/aiModel';
import type { AnswerMode } from '@/services/aiSettings';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Heading, Label } from '@/components/ui/Typography';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB';
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  mode: AnswerMode;
  onSelectMode: (mode: AnswerMode) => void;
  groqAvailable: boolean;
  aiInferenceAvailable: boolean;
  modelInfo: ActiveModelInfo | null;
  hasDownloadedModel: boolean;
  hasImportedModelFile: boolean;
  downloading: boolean;
  importing: boolean;
  progress: DownloadProgress | null;
  onDownload: () => void;
  onImport: () => void;
  onUseImported: () => void;
  onClearChat: () => void;
};

// Same plain-overlay pattern as VoiceSettingsSheet.tsx/TranslationSheet.tsx (not RN's
// <Modal>) — a separate native Window redraws the host window on open/close, which
// reads as the tab bar "flicking".
export function AISettingsSheet({
  visible,
  onClose,
  mode,
  onSelectMode,
  groqAvailable,
  aiInferenceAvailable,
  modelInfo,
  hasDownloadedModel,
  hasImportedModelFile,
  downloading,
  importing,
  progress,
  onDownload,
  onImport,
  onUseImported,
  onClearChat,
}: Props) {
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
            maxHeight: '85%',
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing.lg,
            paddingBottom: theme.spacing.xl,
          }}
        >
          <Heading style={{ fontSize: theme.fontSize.md, marginBottom: theme.spacing.sm }}>AI Assistant Settings</Heading>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Label style={{ marginBottom: theme.spacing.xs }}>Answer source</Label>
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: theme.colors.surfaceMuted,
                borderRadius: theme.radius.pill,
                padding: 3,
                marginBottom: theme.spacing.md,
              }}
            >
              {(['offline', 'online'] as const).map((m) => {
                const isSelected = mode === m;
                return (
                  <PressableScale key={m} onPress={() => onSelectMode(m)} scaleTo={0.97} style={{ flex: 1 }}>
                    <View
                      style={{
                        paddingVertical: theme.spacing.xs + 2,
                        borderRadius: theme.radius.pill,
                        alignItems: 'center',
                        backgroundColor: isSelected ? theme.colors.primary : 'transparent',
                      }}
                    >
                      <Body
                        style={{
                          fontSize: theme.fontSize.sm,
                          fontFamily: theme.fontFamily.sansSemiBold,
                          color: isSelected ? theme.colors.onPrimary : theme.colors.textMuted,
                        }}
                      >
                        {m === 'offline' ? 'Offline' : 'Online'}
                      </Body>
                    </View>
                  </PressableScale>
                );
              })}
            </View>

            {mode === 'offline' && !aiInferenceAvailable && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  backgroundColor: theme.colors.accentSoft,
                  padding: theme.spacing.sm + 2,
                  borderRadius: theme.radius.md,
                  marginBottom: theme.spacing.md,
                }}
              >
                <Info size={16} color={theme.colors.accent} strokeWidth={1.75} style={{ marginTop: 2 }} />
                <Body style={{ flex: 1, marginLeft: theme.spacing.xs, fontSize: theme.fontSize.sm, color: theme.colors.onAccent }}>
                  {modelInfo?.ready
                    ? "Model ready. This banner stays until you're running a development build Expo Go can't load the on-device model at all."
                    : 'Offline answers need a development build (an on-device model, no internet at chat time). You can set up the model now so it\'s ready the moment that build exists.'}
                </Body>
              </View>
            )}

            {mode === 'online' && !groqAvailable && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  backgroundColor: theme.colors.accentSoft,
                  padding: theme.spacing.sm + 2,
                  borderRadius: theme.radius.md,
                  marginBottom: theme.spacing.md,
                }}
              >
                <Info size={16} color={theme.colors.accent} strokeWidth={1.75} style={{ marginTop: 2 }} />
                <Body style={{ flex: 1, marginLeft: theme.spacing.xs, fontSize: theme.fontSize.sm, color: theme.colors.onAccent }}>
                  Online mode isn't configured yet — switch to Offline above, or ask again once it's set up.
                </Body>
              </View>
            )}

            {mode === 'offline' && (
              <>
                <Label style={{ marginBottom: theme.spacing.xs }}>Offline model</Label>
                {modelInfo?.ready && (
                  <Body style={{ fontSize: theme.fontSize.sm, color: theme.colors.textMuted, marginBottom: theme.spacing.xs }}>
                    Using {modelInfo.source === 'import' ? modelInfo.importedName ?? 'imported model' : 'downloaded model'}
                  </Body>
                )}

                <PressableScale onPress={onDownload} scaleTo={0.98} disabled={downloading || importing}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: theme.colors.primary,
                      borderRadius: theme.radius.md,
                      padding: theme.spacing.sm + 2,
                      opacity: downloading || importing ? 0.7 : 1,
                      marginBottom: theme.spacing.sm,
                    }}
                  >
                    <Download size={16} color={theme.colors.onPrimary} strokeWidth={2} />
                    <Body style={{ color: theme.colors.onPrimary, fontFamily: theme.fontFamily.sansSemiBold, marginLeft: theme.spacing.xs }}>
                      {downloading ? 'Downloading model…' : hasDownloadedModel ? 'Use downloaded model' : 'Download AI model (~800 MB)'}
                    </Body>
                  </View>
                </PressableScale>
                {downloading && progress && progress.totalBytes > 0 && (
                  <View style={{ marginBottom: theme.spacing.sm }}>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.surfaceMuted, overflow: 'hidden' }}>
                      <View
                        style={{
                          height: '100%',
                          width: `${Math.min(100, (progress.bytesWritten / progress.totalBytes) * 100)}%`,
                          backgroundColor: theme.colors.primary,
                        }}
                      />
                    </View>
                    <Label style={{ marginTop: 4, textAlign: 'center' }}>
                      {formatBytes(progress.bytesWritten)} / {formatBytes(progress.totalBytes)}
                    </Label>
                  </View>
                )}

                <PressableScale onPress={hasImportedModelFile ? onUseImported : onImport} scaleTo={0.98} disabled={downloading || importing}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: theme.colors.surfaceMuted,
                      borderRadius: theme.radius.md,
                      padding: theme.spacing.sm + 2,
                      opacity: downloading || importing ? 0.7 : 1,
                    }}
                  >
                    <FolderOpen size={16} color={theme.colors.text} strokeWidth={2} />
                    <Body style={{ color: theme.colors.text, fontFamily: theme.fontFamily.sansSemiBold, marginLeft: theme.spacing.xs }}>
                      {importing ? 'Importing model…' : hasImportedModelFile ? 'Use imported model' : 'Import your own model (.gguf)'}
                    </Body>
                  </View>
                </PressableScale>
              </>
            )}

            <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing.md }} />

            <PressableScale onPress={onClearChat} scaleTo={0.98}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: theme.colors.danger,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.sm + 2,
                }}
              >
                <Trash2 size={16} color={theme.colors.danger} strokeWidth={2} />
                <Body style={{ color: theme.colors.danger, fontFamily: theme.fontFamily.sansSemiBold, marginLeft: theme.spacing.xs }}>
                  Clear chat history
                </Body>
              </View>
            </PressableScale>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}
