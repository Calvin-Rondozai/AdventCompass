import React, { useMemo } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

type Props = { size?: number; night: boolean };
type Star = { top: number; left: number; size: number; delay: number; driftX: number; driftY: number };

function makeStars(count: number): Star[] {
  return Array.from({ length: count }, () => ({
    top: Math.random() * 55,
    left: Math.random() * 92,
    size: 1.4 + Math.random() * 2,
    delay: Math.round(Math.random() * 1600),
    driftX: (Math.random() - 0.5) * 7,
    driftY: (Math.random() - 0.5) * 5,
  }));
}

// Width of the blended-to-background border around the art, on every side.
const EDGE = 22;

// The small hills + sun/moon scene next to the dashboard greeting. Purely decorative,
// and tied to the real clock (see getTimeOfDay in the caller) rather than the app's
// light/dark theme — stars and the moon only show during actual night AND evening
// hours; daytime always gets the sun with no stars, regardless of which theme is active.
//
// The edges blend into the page background via four LinearGradient overlays (matching
// the page's own background color) rather than an SVG mask — masks are the "more
// correct" tool for this, but this app already proves LinearGradient works reliably
// everywhere it's used, so this sidesteps any doubt about SVG mask support on Android
// and guarantees no hard rectangular cutoff on any side, in exchange for a fixed-width
// border rather than a soft radial falloff.
//
// Stars glow (opacity pulse) and drift (a few px of translate) via Moti, the same
// animation library the app's NightSky component already uses for its own twinkle.
export function DashboardHeroArt({ size = 110, night }: Props) {
  const theme = useTheme();
  const width = size;
  const height = size * 0.86;
  const stars = useMemo(() => makeStars(night ? 9 : 0), [night]);
  const bg = theme.colors.background;
  const bgTransparent = `${bg}00`;

  const hillFar = `M0,${height * 0.62} Q${width * 0.28},${height * 0.38} ${width * 0.5},${height * 0.58} T${width},${height * 0.5} L${width},${height} L0,${height} Z`;
  const hillNear = `M0,${height * 0.76} Q${width * 0.32},${height * 0.56} ${width * 0.58},${height * 0.72} T${width},${height * 0.66} L${width},${height} L0,${height} Z`;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {night ? (
          <>
            <Path d={hillFar} fill="#233257" opacity={0.9} />
            <Path d={hillNear} fill="#182444" />
          </>
        ) : (
          <>
            <Path d={hillFar} fill="#BFE3C6" />
            <Path d={hillNear} fill="#8FCB9E" />
          </>
        )}
        <Circle cx={width * 0.74} cy={height * 0.3} r={width * 0.13} fill={night ? '#E6E9FB' : '#FBD675'} opacity={night ? 0.95 : 1} />
      </Svg>

      {night &&
        stars.map((s, i) => (
          <MotiView
            key={i}
            from={{ opacity: 0.2, translateX: 0, translateY: 0 }}
            animate={{ opacity: 0.95, translateX: s.driftX, translateY: s.driftY }}
            transition={{ type: 'timing', duration: 2200, delay: s.delay, loop: true, repeatReverse: true }}
            style={{
              position: 'absolute',
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: s.size,
              height: s.size,
              borderRadius: s.size,
              backgroundColor: '#FFFFFF',
              shadowColor: '#FFFFFF',
              shadowOpacity: 0.9,
              shadowRadius: s.size * 2,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
        ))}

      <LinearGradient
        pointerEvents="none"
        colors={[bg, bgTransparent]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: EDGE }}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[bgTransparent, bg]}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: EDGE }}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[bg, bgTransparent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: EDGE }}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[bgTransparent, bg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: EDGE }}
      />
    </View>
  );
}
