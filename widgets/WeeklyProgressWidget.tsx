import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { HabitType, WeekDay } from '@/database/habits';

const ROWS: { type: HabitType; label: string }[] = [
  { type: 'bible_study', label: 'Bible' },
  { type: 'prayer', label: 'Prayer' },
  { type: 'exercise', label: 'Workout' },
  { type: 'water', label: 'Water' },
];

const FILLED = '#22C55E';
const EMPTY = '#E5E7EB';

type Props = { week: Record<HabitType, WeekDay[]> };

export function WeeklyProgressWidget({ week }: Props) {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 12,
        flexDirection: 'column',
      }}
      clickAction="OPEN_APP"
    >
      <TextWidget text="This Week" style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }} />
      {ROWS.map(({ type, label }) => (
        <FlexWidget
          key={type}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}
        >
          <TextWidget text={label} style={{ fontSize: 11, color: '#374151', width: 54 }} />
          <FlexWidget style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
            {(week[type] ?? []).map((day) => (
              <FlexWidget
                key={day.date}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: day.completed ? FILLED : EMPTY,
                }}
              />
            ))}
          </FlexWidget>
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}
