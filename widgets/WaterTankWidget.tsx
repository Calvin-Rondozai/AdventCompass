import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { mlToCups } from '@/database/habits';

const TRACK_HEIGHT = 64;
const PRIMARY = '#2563EB';
const TRACK = '#DCE6F5';

type Props = { waterMl: number; waterGoalMl: number };

// RemoteViews (what every Android home-screen widget actually renders as) has no
// vector-graphics/SVG support and no gradients — this approximates the app's
// WaterBottle component as a plain rectangle whose fill height is computed here in JS
// before render, rather than trying to reproduce the in-app component's shape.
export function WaterTankWidget({ waterMl, waterGoalMl }: Props) {
  const ratio = waterGoalMl > 0 ? Math.min(1, waterMl / waterGoalMl) : 0;
  const fillHeight = Math.round(TRACK_HEIGHT * ratio);

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
      clickAction="OPEN_APP"
    >
      <FlexWidget
        style={{
          width: 28,
          height: TRACK_HEIGHT,
          backgroundColor: TRACK,
          borderRadius: 10,
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        <FlexWidget style={{ width: 28, height: fillHeight, backgroundColor: PRIMARY, borderRadius: 10 }} />
      </FlexWidget>

      <FlexWidget style={{ flex: 1, height: 'match_parent', flexDirection: 'column', justifyContent: 'center', marginLeft: 10 }}>
        <TextWidget text="Water" style={{ fontSize: 12, color: '#6B7280' }} />
        <TextWidget
          text={`${mlToCups(waterMl)} / ${mlToCups(waterGoalMl)} cups`}
          style={{ fontSize: 15, fontWeight: 'bold', color: '#111827' }}
        />
      </FlexWidget>

      <FlexWidget
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: PRIMARY,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        clickAction="ADD_WATER"
      >
        <TextWidget text="+" style={{ fontSize: 20, color: '#FFFFFF', fontWeight: 'bold' }} />
      </FlexWidget>
    </FlexWidget>
  );
}
