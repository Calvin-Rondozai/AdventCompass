import type React from 'react';
import { Platform } from 'react-native';

// react-native-android-widget is an Android-only native module — requiring it
// unconditionally (a static top-level import) would break the iOS and web builds this
// project also targets (see app.json's "web" config). Guarded the same way
// services/notifications.ts guards expo-notifications: only ever required on Android,
// and only once.
type RequestWidgetUpdate = (options: {
  widgetName: string;
  renderWidget: () => Promise<React.JSX.Element>;
}) => Promise<void>;

let requestWidgetUpdate: RequestWidgetUpdate | null = null;
if (Platform.OS === 'android') {
  try {
    ({ requestWidgetUpdate } = require('react-native-android-widget'));
  } catch {
    requestWidgetUpdate = null;
  }
}

// Call after any change to bible_study/prayer/exercise/water habit data — the home-screen
// widgets also refresh on their own 30-minute timer, but that's a long wait after a user
// just tapped +1 cup in the app and expects their widget to reflect it right away.
// requestWidgetUpdate calls back into this same render logic for every instance of that
// widget currently on the home screen (there may be none — it's a no-op then).
export function refreshHomeWidgets(): void {
  if (!requestWidgetUpdate) return;
  // Required at call time (not statically at module load) so importing this file never
  // pulls in the widgets/ tree — and its database/expo-sqlite imports — on iOS or web.
  const { renderWaterTank, renderWeeklyProgress } = require('@/widgets/render');
  requestWidgetUpdate({ widgetName: 'WaterTank', renderWidget: renderWaterTank }).catch(() => {});
  requestWidgetUpdate({ widgetName: 'WeeklyProgress', renderWidget: renderWeeklyProgress }).catch(() => {});
}
