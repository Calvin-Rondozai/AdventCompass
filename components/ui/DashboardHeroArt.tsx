import React from 'react';
import { Image } from 'react-native';
import type { TimeOfDay } from '@/utils/greeting';

// One illustration per time of day, shown next to the dashboard greeting — tied to the
// real clock (see getTimeOfDay in the caller), not the app's light/dark theme.
const HERO_IMAGES: Record<TimeOfDay, number> = {
  morning: require('@/assets/img/hero-morning.png'),
  afternoon: require('@/assets/img/hero-afternoon.png'),
  evening: require('@/assets/img/hero-evening.png'),
  night: require('@/assets/img/hero-night.png'),
};

type Props = { size?: number; timeOfDay: TimeOfDay };

export function DashboardHeroArt({ size = 110, timeOfDay }: Props) {
  return <Image source={HERO_IMAGES[timeOfDay]} style={{ width: size, height: size }} resizeMode="contain" />;
}
