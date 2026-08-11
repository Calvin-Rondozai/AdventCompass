import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { addWater, todayKey, WATER_STEP_ML } from '@/database/habits';
import { getWaterGoal } from '@/database/wellnessGoals';
import { getWidgetDb } from './widgetDb';
import { renderWaterTank, renderWeeklyProgress } from './render';

// Registered as this app's headless entry point (see index.ts) — runs outside the normal
// React tree, so every widget name this app defines (app.json's react-native-android-widget
// plugin config) has to be handled here by name; there's one shared entry point for all of
// them, not one handler per widget.
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetName = props.widgetInfo.widgetName;

  if (props.widgetAction === 'WIDGET_CLICK' && widgetName === 'WaterTank' && props.clickAction === 'ADD_WATER') {
    const db = getWidgetDb();
    const date = todayKey();
    const waterGoalMl = await getWaterGoal(db);
    await addWater(db, date, WATER_STEP_ML, waterGoalMl);
  }

  switch (widgetName) {
    case 'WaterTank':
      props.renderWidget(await renderWaterTank());
      break;
    case 'WeeklyProgress':
      props.renderWidget(await renderWeeklyProgress());
      break;
  }
}
