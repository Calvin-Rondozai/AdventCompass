import React, { useEffect } from 'react';
import Svg, { ClipPath, Defs, Path } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Props = { progress: number; size?: number; color: string; trackColor: string; bump?: number };

// The tapered open-top tumbler from the dashboard mockup — wider at the rim than the
// base, unlike the narrow-necked WaterBottle used on the Health screen/widget. Kept as
// its own component rather than a WaterBottle variant since those call sites shouldn't
// change shape.
//
// `bump` is a nonce the caller increments on every "add water" tap. Bumping it plays a
// quick slosh: the water surface dips and overshoots as a wavy curve before settling
// flat, instead of the fill level just snapping/animating in a straight line.
export function WaterGlass({ progress, size = 40, color, trackColor, bump }: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  const inset = size * 0.14;
  const topLeft = inset;
  const topRight = size - inset;
  const bottomLeft = inset + size * 0.1;
  const bottomRight = size - inset - size * 0.1;
  const top = size * 0.06;
  const bottom = size * 0.94;
  const glassPath = `M${topLeft},${top} L${topRight},${top} L${bottomRight},${bottom} L${bottomLeft},${bottom} Z`;
  const waterY = bottom - (bottom - top) * clamped;

  const waterYSV = useSharedValue(waterY);
  const wobble = useSharedValue(0);
  const isFirstRun = React.useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      waterYSV.value = waterY;
      return;
    }
    waterYSV.value = withSpring(waterY, { damping: 7, stiffness: 110, mass: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waterY]);

  useEffect(() => {
    if (bump === undefined) return;
    wobble.value = withSequence(
      withTiming(1, { duration: 90 }),
      withTiming(-0.65, { duration: 150 }),
      withTiming(0.35, { duration: 150 }),
      withTiming(0, { duration: 180 })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bump]);

  // Drawn full-width (0..size), not tapered to the glass's own bottom width — the
  // clipPath below crops this to the glass shape at whatever the taper is at each
  // height, so the fill always reaches both slanted sides with no gap, at any level.
  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const amp = 2.6 * wobble.value;
    const y = waterYSV.value;
    const wavePath = `M0,${y} Q${size / 2},${y - amp} ${size},${y} L${size},${size} L0,${size} Z`;
    return { d: wavePath };
  });

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <ClipPath id="waterGlassClip">
          <Path d={glassPath} />
        </ClipPath>
      </Defs>
      <Path d={glassPath} fill={trackColor} />
      <AnimatedPath animatedProps={animatedProps} fill={color} clipPath="url(#waterGlassClip)" />
      <Path d={glassPath} stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
  );
}
