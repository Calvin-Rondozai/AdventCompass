import React, { useCallback } from 'react';
import {
  Image,
  LayoutChangeEvent,
  NativeSyntheticEvent,
  TextInput,
  TextInputSelectionChangeEventData,
  View,
} from 'react-native';
import Animated, { LinearTransition, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { CheckCircle2, GripVertical, Plus, X } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import type { ChecklistItem, NoteBlock } from '@/database/notes';
import { newLocalId } from '@/utils/localId';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body } from '@/components/ui/Typography';

type Props = {
  block: NoteBlock;
  onLayout: (id: string, y: number, height: number) => void;
  onDragEnd: (id: string, finalTranslateY: number) => void;
  onTextChange: (id: string, text: string) => void;
  onTextFocus: (id: string) => void;
  onTextSelectionChange: (id: string, start: number) => void;
  onChecklistChange: (id: string, items: ChecklistItem[]) => void;
  onRemoveBlock: (id: string) => void;
};

// One block of a note (a text run, a checklist, or a photo) — any number of each are
// allowed, in any order. The grip icon drags the whole block: `onUpdate` follows the
// finger directly (no long-press gate needed, since the handle is its own small target
// that doesn't compete with the surrounding ScrollView's own pan-to-scroll gesture the
// way free-form text would); the parent screen owns everyone's layout position and
// decides the actual reorder once the drag ends, since that requires comparing against
// every sibling, not just this one block's own state.
export function NoteBlockItem({
  block,
  onLayout,
  onDragEnd,
  onTextChange,
  onTextFocus,
  onTextSelectionChange,
  onChecklistChange,
  onRemoveBlock,
}: Props) {
  const theme = useTheme();
  const translateY = useSharedValue(0);
  const dragging = useSharedValue(false);

  const finishDrag = useCallback(
    (y: number) => {
      onDragEnd(block.id, y);
      translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
    },
    [block.id, onDragEnd, translateY]
  );

  const pan = Gesture.Pan()
    .onStart(() => {
      dragging.value = true;
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      dragging.value = false;
      runOnJS(finishDrag)(e.translationY);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    zIndex: dragging.value ? 10 : 0,
    opacity: dragging.value ? 0.92 : 1,
  }));

  return (
    <Animated.View
      layout={LinearTransition.duration(220)}
      style={[animatedStyle, { flexDirection: 'row', alignItems: 'flex-start' }]}
      onLayout={(e: LayoutChangeEvent) => onLayout(block.id, e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
    >
      {block.type !== 'text' && (
        <GestureDetector gesture={pan}>
          <View style={{ padding: theme.spacing.xs, marginTop: theme.spacing.sm }}>
            <GripVertical size={16} color={theme.colors.textFaint} />
          </View>
        </GestureDetector>
      )}

      <View style={{ flex: 1 }}>
        {block.type === 'text' && (
          <TextInput
            value={block.text}
            onChangeText={(t) => onTextChange(block.id, t)}
            onFocus={() => onTextFocus(block.id)}
            onSelectionChange={(e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) =>
              onTextSelectionChange(block.id, e.nativeEvent.selection.start)
            }
            placeholder="Write your note…"
            placeholderTextColor={theme.colors.textFaint}
            multiline
            textAlignVertical="top"
            style={{
              fontFamily: theme.fontFamily.sansRegular,
              fontSize: theme.fontSize.base,
              lineHeight: theme.lineHeight.base,
              color: theme.colors.text,
              minHeight: 44,
            }}
          />
        )}

        {block.type === 'checklist' && (
          <View
            style={{
              backgroundColor: theme.colors.surfaceMuted,
              borderRadius: theme.radius.md,
              padding: theme.spacing.sm + 2,
              gap: theme.spacing.xs,
            }}
          >
            {block.items.map((item) => (
              <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <PressableScale
                  onPress={() =>
                    onChecklistChange(
                      block.id,
                      block.items.map((it) => (it.id === item.id ? { ...it, done: !it.done } : it))
                    )
                  }
                  style={{ padding: theme.spacing.xs }}
                >
                  <CheckCircle2
                    size={20}
                    color={item.done ? theme.colors.primary : theme.colors.textFaint}
                    fill={item.done ? theme.colors.primary : 'transparent'}
                  />
                </PressableScale>
                <TextInput
                  value={item.text}
                  onChangeText={(text) =>
                    onChecklistChange(block.id, block.items.map((it) => (it.id === item.id ? { ...it, text } : it)))
                  }
                  placeholder="List item"
                  placeholderTextColor={theme.colors.textFaint}
                  style={{
                    flex: 1,
                    fontFamily: theme.fontFamily.sansRegular,
                    fontSize: theme.fontSize.base,
                    color: item.done ? theme.colors.textFaint : theme.colors.text,
                    textDecorationLine: item.done ? 'line-through' : 'none',
                  }}
                />
                <PressableScale
                  onPress={() => onChecklistChange(block.id, block.items.filter((it) => it.id !== item.id))}
                  style={{ padding: theme.spacing.xs }}
                >
                  <X size={16} color={theme.colors.textFaint} />
                </PressableScale>
              </View>
            ))}
            <PressableScale
              onPress={() => onChecklistChange(block.id, [...block.items, { id: newLocalId(), text: '', done: false }])}
              scaleTo={0.98}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: theme.spacing.xs }}>
                <Plus size={18} color={theme.colors.primary} strokeWidth={2} />
                <Body style={{ marginLeft: theme.spacing.xs, color: theme.colors.primary, fontFamily: theme.fontFamily.sansMedium }}>
                  Add item
                </Body>
              </View>
            </PressableScale>
          </View>
        )}

        {block.type === 'image' && (
          <View style={{ borderRadius: theme.radius.md, overflow: 'hidden' }}>
            <Image source={{ uri: block.uri }} style={{ width: '100%', height: 200 }} resizeMode="cover" />
          </View>
        )}
      </View>

      {block.type !== 'text' && (
        <PressableScale onPress={() => onRemoveBlock(block.id)} style={{ padding: theme.spacing.xs }}>
          <X size={16} color={theme.colors.textFaint} />
        </PressableScale>
      )}
    </Animated.View>
  );
}
