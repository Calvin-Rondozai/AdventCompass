import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';
import * as Lucide from 'lucide-react-native';

// A drop-in replacement for the lucide-react-native icons this app used to import —
// same component names and props (size/color/style, plus fill for the handful of
// screens that toggle a filled vs. outline look), so every call site kept working
// unchanged. Only this file needed to change to switch the whole app from lucide's
// line-icon set to Ionicons' filled, native-feeling icon set.
type IconProps = {
  size?: number;
  color?: string;
  fill?: string;
  strokeWidth?: number;
  style?: StyleProp<TextStyle>;
};

function isFilled(fill?: string) {
  return !!fill && fill !== 'transparent' && fill !== 'none';
}

function makeIcon(filledName: keyof typeof Ionicons.glyphMap, outlineName?: keyof typeof Ionicons.glyphMap) {
  return function IconComponent({ size = 20, color, fill, style }: IconProps) {
    const name = outlineName ? (isFilled(fill) ? filledName : outlineName) : filledName;
    return <Ionicons name={name} size={size} color={color} style={style} />;
  };
}

// Two icons kept on lucide by explicit request — the Ionicons equivalents for these
// specific concepts (prayer, note-taking) didn't read as well as the originals. Wrapped
// (rather than re-exported directly) so their prop type lines up with every other icon
// here — call sites that type an icon slot as `typeof BookOpen` need that to match.
function fromLucide(LucideIcon: React.ComponentType<any>) {
  return function IconComponent({ size = 20, color, fill, strokeWidth, style }: IconProps) {
    return <LucideIcon size={size} color={color} fill={fill} strokeWidth={strokeWidth} style={style} />;
  };
}

export const HeartHandshake = fromLucide(Lucide.HeartHandshake);
export const NotebookPen = fromLucide(Lucide.NotebookPen);

export const Archive = makeIcon('archive');
export const ArrowLeft = makeIcon('arrow-back');
export const ArrowRight = makeIcon('arrow-forward');
export const Bell = makeIcon('notifications');
export const BookHeart = makeIcon('heart-circle');
export const Bookmark = makeIcon('bookmark', 'bookmark-outline');
export const BookMarked = makeIcon('bookmarks');
export const BookOpen = makeIcon('book');
export const CalendarDays = makeIcon('calendar');
export const Check = makeIcon('checkmark');
export const CheckCircle2 = makeIcon('checkmark-circle', 'checkmark-circle-outline');
export const ChevronDown = makeIcon('chevron-down');
export const ChevronUp = makeIcon('chevron-up');
export const ChevronLeft = makeIcon('chevron-back');
export const ChevronRight = makeIcon('chevron-forward');
export const Columns2 = makeIcon('git-compare');
export const Compass = makeIcon('compass');
export const Delete = makeIcon('backspace');
export const Download = makeIcon('download');
export const Droplets = makeIcon('water');
export const Dumbbell = makeIcon('barbell');
export const Flame = makeIcon('flame');
export const Grid3x3 = makeIcon('keypad');
export const HandCoins = makeIcon('cash');
export const Heart = makeIcon('heart', 'heart-outline');
export const HeartPulse = makeIcon('pulse');
export const Home = makeIcon('home');
export const Info = makeIcon('information-circle');
export const Languages = makeIcon('language');
export const Library = makeIcon('library');
export const Link2 = makeIcon('link');
export const ListChecks = makeIcon('list');
export const Mail = makeIcon('mail');
export const Minus = makeIcon('remove');
export const Monitor = makeIcon('desktop');
export const Moon = makeIcon('moon');
export const MoreHorizontal = makeIcon('ellipsis-horizontal');
export const Music = makeIcon('musical-notes');
export const Palette = makeIcon('color-palette');
export const Pencil = makeIcon('pencil');
export const Pin = makeIcon('pin', 'pin-outline');
export const Plus = makeIcon('add');
export const Search = makeIcon('search');
export const Settings = makeIcon('settings');
export const Sparkles = makeIcon('sparkles');
export const Sun = makeIcon('sunny');
export const Sunrise = makeIcon('partly-sunny');
export const Sunset = makeIcon('partly-sunny');
export const Trash2 = makeIcon('trash');
export const Trophy = makeIcon('trophy');
export const User = makeIcon('person');
export const X = makeIcon('close');
