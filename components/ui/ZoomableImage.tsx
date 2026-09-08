import React, { useCallback, useState } from 'react';
import { Image, ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

// ScrollView's maximumZoomScale/minimumZoomScale pinch-zoom only works on iOS — RN doesn't
// implement it on Android at all, so relying on it silently leaves Android users unable to
// zoom. This reimplements pinch + double-tap zoom with gesture-handler/reanimated, which work
// on both platforms, and lives outside the scrolling container so a zoomed pan doesn't fight
// the page's own vertical scroll.
type Props = {
  source: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  maxScale?: number;
  onZoomChange?: (zoomed: boolean) => void;
};

export function ZoomableImage({ source, style, maxScale = 4, onZoomChange }: Props) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const reportZoom = useCallback(
    (zoomed: boolean) => onZoomChange?.(zoomed),
    [onZoomChange]
  );

  // Panning is only allowed to reveal parts of the image pushed out of view by the current
  // zoom level — clamps to (scaled size - container size) / 2 on each axis, and collapses to 0
  // once the image is back to its natural (unzoomed) size.
  const clamp = (value: number, limit: number) => Math.min(Math.max(value, -limit), limit);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), maxScale);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      const limitX = (containerSize.width * (scale.value - 1)) / 2;
      const limitY = (containerSize.height * (scale.value - 1)) / 2;
      translateX.value = withSpring(clamp(translateX.value, limitX));
      translateY.value = withSpring(clamp(translateY.value, limitY));
      savedTranslateX.value = clamp(translateX.value, limitX);
      savedTranslateY.value = clamp(translateY.value, limitY);
      runOnJS(reportZoom)(scale.value > 1.01);
    });

  const pan = Gesture.Pan()
    .minPointers(2)
    .maxPointers(2)
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      const limitX = (containerSize.width * (scale.value - 1)) / 2;
      const limitY = (containerSize.height * (scale.value - 1)) / 2;
      translateX.value = withSpring(clamp(translateX.value, limitX));
      translateY.value = withSpring(clamp(translateY.value, limitY));
      savedTranslateX.value = clamp(translateX.value, limitX);
      savedTranslateY.value = clamp(translateY.value, limitY);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > 1.01 ? 1 : Math.min(2.5, maxScale);
      scale.value = withSpring(next);
      savedScale.value = next;
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
      runOnJS(reportZoom)(next > 1.01);
    });

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[style, animatedStyle]}
        onLayout={(e) => setContainerSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      >
        <Image source={source} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
      </Animated.View>
    </GestureDetector>
  );
}
