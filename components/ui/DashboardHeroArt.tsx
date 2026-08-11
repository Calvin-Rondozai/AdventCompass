import React, { useMemo } from 'react';
import Svg, { Circle, Defs, G, Mask, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

type Props = { size?: number; night: boolean };

type Star = { cx: number; cy: number; r: number };

function makeStars(count: number, width: number, height: number): Star[] {
  return Array.from({ length: count }, () => ({
    cx: Math.round(Math.random() * width),
    cy: Math.round(Math.random() * height * 0.55),
    r: 0.6 + Math.random() * 0.9,
  }));
}

// The small hills + sun/moon scene next to the dashboard greeting. Purely decorative,
// and tied to the real clock (see getTimeOfDay in the caller) rather than the app's
// light/dark theme — stars and the moon only show during actual night hours; daytime
// always gets the sun with no stars, regardless of which theme is active.
//
// The hill shapes are masked through a soft radial gradient so their color fades out
// before it reaches the SVG canvas edge, instead of being hard-cropped by the
// rectangular viewBox — that hard crop is what reads as "a picture in a box" rather
// than art that blends into the page.
export function DashboardHeroArt({ size = 110, night }: Props) {
  const width = size;
  const height = size * 0.86;
  const stars = useMemo(() => makeStars(night ? 10 : 0, width, height), [night, width, height]);
  const maskId = night ? 'heroFadeNight' : 'heroFadeDay';
  const gradId = `${maskId}Gradient`;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <RadialGradient id={gradId} cx="58%" cy="58%" r="65%">
          <Stop offset="45%" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
        <Mask id={maskId}>
          <Rect x={0} y={0} width={width} height={height} fill={`url(#${gradId})`} />
        </Mask>
      </Defs>
      <G mask={`url(#${maskId})`}>
        {night ? (
          <>
            {stars.map((s, i) => (
              <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#FFFFFF" opacity={0.85} />
            ))}
            <Path
              d={`M0,${height * 0.62} Q${width * 0.28},${height * 0.38} ${width * 0.5},${height * 0.58} T${width},${height * 0.5} L${width},${height} L0,${height} Z`}
              fill="#233257"
              opacity={0.9}
            />
            <Path
              d={`M0,${height * 0.76} Q${width * 0.32},${height * 0.56} ${width * 0.58},${height * 0.72} T${width},${height * 0.66} L${width},${height} L0,${height} Z`}
              fill="#182444"
            />
          </>
        ) : (
          <>
            <Path
              d={`M0,${height * 0.62} Q${width * 0.28},${height * 0.38} ${width * 0.5},${height * 0.58} T${width},${height * 0.5} L${width},${height} L0,${height} Z`}
              fill="#BFE3C6"
            />
            <Path
              d={`M0,${height * 0.76} Q${width * 0.32},${height * 0.56} ${width * 0.58},${height * 0.72} T${width},${height * 0.66} L${width},${height} L0,${height} Z`}
              fill="#8FCB9E"
            />
          </>
        )}
      </G>
      <Circle cx={width * 0.74} cy={height * 0.3} r={width * 0.13} fill={night ? '#E6E9FB' : '#FBD675'} opacity={night ? 0.95 : 1} />
    </Svg>
  );
}
