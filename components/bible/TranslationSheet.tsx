import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Check } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { BIBLE_TRANSLATIONS } from '@/database/translations';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Heading, Label } from '@/components/ui/Typography';

type Props = {
  visible: boolean;
  selected: string;
  onSelect: (code: string) => void;
  onClose: () => void;
};

export function TranslationSheet({ visible, selected, onSelect, onClose }: Props) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
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
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                    padding: theme.spacing.md,
                    marginBottom: theme.spacing.sm,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }}>
                      {item.code}: {item.name}
                    </Body>
                    <Label style={{ marginTop: 4 }}>
                      {item.language} · {item.license}
                    </Label>
                  </View>
                  {isSelected && <Check size={18} color={theme.colors.primary} />}
                </View>
              </PressableScale>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
