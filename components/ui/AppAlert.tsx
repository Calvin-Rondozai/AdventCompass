import React, { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Heading } from '@/components/ui/Typography';

export type AppAlertButton = { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };
type AppAlertState = { title: string; message?: string; buttons: AppAlertButton[] };

let listener: ((state: AppAlertState | null) => void) | null = null;

// Drop-in replacement for Alert.alert(title, message, buttons) — same signature — but
// rendered as a themed, rounded-corner modal instead of the OS's square native dialog.
// Mounted once as <AppAlertHost /> near the app root; any screen can call showAlert(...)
// without rendering its own modal.
export function showAlert(title: string, message?: string, buttons?: AppAlertButton[]): void {
  listener?.({ title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] });
}

export function AppAlertHost() {
  const theme = useTheme();
  const [state, setState] = useState<AppAlertState | null>(null);

  useEffect(() => {
    listener = setState;
    return () => {
      listener = null;
    };
  }, []);

  const close = () => setState(null);

  return (
    <Modal visible={!!state} transparent animationType="fade" onRequestClose={close}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg }}
        onPress={close}
      >
        <Pressable
          style={{
            width: '100%',
            maxWidth: 340,
            backgroundColor: theme.colors.background,
            borderRadius: theme.radius.lg,
            padding: theme.spacing.lg,
            gap: theme.spacing.sm,
            ...theme.shadow.floating,
          }}
        >
          {state && (
            <>
              <Heading style={{ fontSize: theme.fontSize.md }}>{state.title}</Heading>
              {!!state.message && <Body style={{ color: theme.colors.textMuted }}>{state.message}</Body>}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                {state.buttons.map((b, i) => (
                  <PressableScale
                    key={i}
                    onPress={() => {
                      close();
                      b.onPress?.();
                    }}
                    scaleTo={0.96}
                  >
                    <View
                      style={{
                        paddingVertical: theme.spacing.sm,
                        paddingHorizontal: theme.spacing.md,
                        borderRadius: theme.radius.md,
                        backgroundColor:
                          b.style === 'destructive' ? theme.colors.danger : b.style === 'cancel' ? theme.colors.surfaceMuted : theme.colors.primary,
                      }}
                    >
                      <Body
                        style={{
                          color: b.style === 'cancel' ? theme.colors.text : theme.colors.onPrimary,
                          fontFamily: theme.fontFamily.sansSemiBold,
                        }}
                      >
                        {b.text}
                      </Body>
                    </View>
                  </PressableScale>
                ))}
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
