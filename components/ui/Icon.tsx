import React from 'react';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

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

// Ionicons' "pin" is a map/location-pin teardrop, not the pushpin/thumbtack shape people
// actually mean by "pin this note" — FontAwesome5's "thumbtack" is the real thing.
function makeFA5Icon(name: string) {
  return function IconComponent({ size = 20, color, style }: IconProps) {
    return <FontAwesome5 name={name} size={size} color={color} solid style={style} />;
  };
}

// Swapped from Lucide's NotebookPen/HeartHandshake to these FontAwesome5 glyphs on
// request for a different look for the note-taking and prayer concepts — a literal
// sticky note and literal praying hands read more distinctly than the previous pair.
// Every call site imports these by name (HeartHandshake, NotebookPen), so nothing else
// needed to change.
export const HeartHandshake = makeFA5Icon('praying-hands');
export const NotebookPen = makeFA5Icon('sticky-note');

export const Archive = makeIcon('archive');
export const ArrowLeft = makeIcon('arrow-back');
export const ArrowRight = makeIcon('arrow-forward');
export const ArrowUp = makeIcon('arrow-up');
export const Bell = makeIcon('notifications');
export const BookHeart = makeIcon('heart-circle');
export const Bookmark = makeIcon('bookmark', 'bookmark-outline');
export const BookMarked = makeIcon('bookmarks');
export const BookOpen = makeIcon('book');
export const CalendarDays = makeIcon('calendar');
export const CalendarClock = makeIcon('calendar-number');
export const Check = makeIcon('checkmark');
export const CheckCircle2 = makeIcon('checkmark-circle', 'checkmark-circle-outline');
export const ChevronDown = makeIcon('chevron-down');
export const ChevronUp = makeIcon('chevron-up');
export const ChevronLeft = makeIcon('chevron-back');
export const ChevronRight = makeIcon('chevron-forward');
export const Copy = makeIcon('copy', 'copy-outline');
// Drawn with plain Views rather than an icon font — FontAwesome5's "columns" glyph was
// a good semantic match (a box split in two) but its font file repeatedly failed to
// load over the Metro dev server in practice. Two bordered boxes side by side reads the
// same way and can't fail to fetch, since there's nothing to fetch.
function ColumnsIcon({ size = 20, color = '#000', style }: IconProps) {
  const height = size * 0.8;
  const borderWidth = Math.max(1.5, size * 0.1);
  return (
    <View style={[{ width: size, height, flexDirection: 'row', gap: Math.max(1, size * 0.12) }, style as StyleProp<ViewStyle>]}>
      <View style={{ flex: 1, borderWidth, borderColor: color, borderRadius: size * 0.08 }} />
      <View style={{ flex: 1, borderWidth, borderColor: color, borderRadius: size * 0.08 }} />
    </View>
  );
}
export const Columns = ColumnsIcon;
export const Compass = makeIcon('compass');
export const Delete = makeIcon('backspace');
export const Download = makeIcon('download');
export const FolderOpen = makeIcon('folder-open');
export const Droplets = makeIcon('water');
export const Dumbbell = makeIcon('barbell');
export const Flame = makeIcon('flame');
export const Gift = makeIcon('gift');
export const Grid3x3 = makeIcon('keypad');
export const HandCoins = makeIcon('cash');
export const Heart = makeIcon('heart', 'heart-outline');
export const HeartPulse = makeIcon('pulse');
export const ImageIcon = makeIcon('image', 'image-outline');
export const GripVertical = makeIcon('reorder-three', 'reorder-three-outline');
export const Headset = makeIcon('headset', 'headset-outline');
export const Highlighter = makeIcon('color-wand', 'color-wand-outline');
export const Home = makeIcon('home');
export const Info = makeIcon('information-circle');
export const Languages = makeIcon('language');
export const Library = makeIcon('library');
export const Link2 = makeIcon('link');
export const ListChecks = makeIcon('list');
export const Mail = makeIcon('mail');
export const Menu = makeIcon('menu');
export const Minus = makeIcon('remove');
export const Monitor = makeIcon('desktop');
export const Moon = makeIcon('moon');
export const MoreHorizontal = makeIcon('ellipsis-horizontal');
export const Music = makeIcon('musical-notes');
export const Palette = makeIcon('color-palette');
export const Pause = makeIcon('pause-circle', 'pause-circle-outline');
export const Pencil = makeIcon('pencil');
export const Pin = makeFA5Icon('thumbtack');
export const Play = makeIcon('play-circle', 'play-circle-outline');
export const Plus = makeIcon('add');
export const RefreshCw = makeIcon('refresh');
export const Search = makeIcon('search');
export const Settings = makeIcon('settings');
export const ShareIcon = makeIcon('share-social');
export const SkipBack = makeIcon('play-skip-back');
export const SkipForward = makeIcon('play-skip-forward');
export const Sparkles = makeIcon('sparkles');
export const Sun = makeIcon('sunny');
export const Sunrise = makeIcon('partly-sunny');
export const Sunset = makeIcon('partly-sunny');
export const Trash2 = makeIcon('trash');
export const Trophy = makeIcon('trophy');
export const User = makeIcon('person');
export const Volume2 = makeIcon('volume-high');
export const Wifi = makeIcon('wifi');
export const X = makeIcon('close');
