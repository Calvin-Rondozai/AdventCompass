import React, { useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Heading, Label } from '@/components/ui/Typography';
import { ScheduleIconPicker, SCHEDULE_ICON_CHOICES, ScheduleIconName } from '@/components/ui/ScheduleIconPicker';

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdd: (label: string, icon: ScheduleIconName) => void;
};

export function AddScheduleItemSheet({ visible, onClose, onAdd }: Props) {
  const theme = useTheme();
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState<ScheduleIconName>(SCHEDULE_ICON_CHOICES[0]);

  const reset = () => {
    setLabel('');
    setIcon(SCHEDULE_ICON_CHOICES[0]);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    onAdd(trimmed, icon);
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
        onPress={close}
      >
        <Pressable
          style={{
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing.lg,
            paddingBottom: theme.spacing.xl,
            gap: theme.spacing.md,
          }}
        >
          <Heading style={{ fontSize: theme.fontSize.md }}>Add to Today's Schedule</Heading>

          <View>
            <Label style={{ marginBottom: theme.spacing.xs }}>What do you want to track?</Label>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. Journaling, Devotional reading"
              placeholderTextColor={theme.colors.textFaint}
              style={{
                backgroundColor: theme.colors.surfaceMuted,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.border,
                padding: theme.spacing.sm + 2,
                color: theme.colors.text,
                fontFamily: theme.fontFamily.sansRegular,
                fontSize: theme.fontSize.base,
              }}
              autoFocus
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
          </View>

          <View>
            <Label style={{ marginBottom: theme.spacing.xs }}>Icon</Label>
            <ScheduleIconPicker value={icon} onChange={setIcon} />
          </View>

          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
            <PressableScale onPress={close} scaleTo={0.98} style={{ flex: 1 }}>
              <View
                style={{
                  padding: theme.spacing.sm + 2,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.surfaceMuted,
                  alignItems: 'center',
                }}
              >
                <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }}>Cancel</Body>
              </View>
            </PressableScale>
            <PressableScale onPress={submit} scaleTo={0.98} style={{ flex: 1 }} disabled={!label.trim()}>
              <View
                style={{
                  padding: theme.spacing.sm + 2,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.primary,
                  alignItems: 'center',
                  opacity: label.trim() ? 1 : 0.5,
                }}
              >
                <Body style={{ color: theme.colors.onPrimary, fontFamily: theme.fontFamily.sansSemiBold }}>Add</Body>
              </View>
            </PressableScale>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
