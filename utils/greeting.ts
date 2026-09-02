import { getSunsetTime } from '@/utils/sunset';

export type TimeOfDay = 'night' | 'morning' | 'afternoon' | 'evening';
export type Coordinates = { latitude: number; longitude: number };

// Used when a real Saturday sunset can't be computed yet (location permission denied, or no
// fix obtained yet) — a reasonable evening estimate so Sabbath doesn't just cut off at
// midnight while location is still resolving.
const FALLBACK_SATURDAY_SUNSET_HOUR = 19;

export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours();
  if (hour < 5 || hour >= 20) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

// The plain time-of-day greeting, with no Sabbath override — used for the dashboard's
// small "Good morning" label, which stays on this even while the big headline switches
// to "Happy Sabbath"/"Happy Preparation Day".
export function getTimeGreeting(date: Date = new Date()): string {
  switch (getTimeOfDay(date)) {
    case 'night':
      return 'Good Evening';
    case 'morning':
      return 'Good Morning';
    case 'afternoon':
      return 'Good Afternoon';
    case 'evening':
      return 'Good Evening';
  }
}

export function getGreeting(date: Date = new Date(), location?: Coordinates | null): string {
  const day = date.getDay(); // 0=Sunday .. 5=Friday, 6=Saturday

  if (day === 5) {
    // Preparation Day ends and Sabbath begins at a fixed 5pm, not actual sunset.
    return date.getHours() < 17 ? 'Happy Preparation Day' : 'Happy Sabbath';
  }

  if (day === 6) {
    const sunset = location ? getSunsetTime(date, location.latitude, location.longitude) : null;
    const cutoff = sunset ?? new Date(date.getFullYear(), date.getMonth(), date.getDate(), FALLBACK_SATURDAY_SUNSET_HOUR, 0, 0);
    if (date.getTime() < cutoff.getTime()) return 'Happy Sabbath';
    // Past sunset Saturday — Sabbath has ended, fall through to the normal greeting below.
  }

  return getTimeGreeting(date);
}

export function formatLongDate(date: Date = new Date()): string {
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}
