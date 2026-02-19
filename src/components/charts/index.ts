/**
 * Charts Module
 * 
 * Reusable chart components for FitQuest analytics.
 * Uses themed styling with fallback visualizations.
 * 
 * Victory-native integration planned for future enhancement.
 * 
 * Usage:
 * ```tsx
 * import { 
 *   WorkoutTrendChart, 
 *   StepsChart, 
 *   StreakCalendar 
 * } from '../components/charts';
 * ```
 */

// Types
export type {
  TimeSeriesPoint,
  LabeledDataPoint,
  WorkoutDataPoint,
  XPDataPoint,
  StepDataPoint,
  HeartRateDataPoint,
  SleepDataPoint,
  MuscleGroupDataPoint,
  StreakDay,
  DateRangeOption,
  HeartRateZone,
  ChartConfig,
  ChartThemeColors,
  BaseChartProps,
  WorkoutTrendChartProps,
  XPProgressChartProps,
  StepsChartProps,
  HeartRateChartProps,
  SleepChartProps,
  MuscleDistributionChartProps,
  StreakCalendarProps,
} from './types';

// Constants
export {
  DATE_RANGE_LABELS,
  HEART_RATE_ZONE_COLORS,
  MUSCLE_GROUP_COLORS,
  DEFAULT_CHART_CONFIG,
  DARK_CHART_THEME,
  LIGHT_CHART_THEME,
} from './types';

// Themed Components
export {
  ThemedChartWrapper,
  useChartTheme,
  DateRangeSelector,
  MiniStat,
  ChartLegend,
} from './ThemedChart';

// Chart Components
export { WorkoutTrendChart } from './WorkoutTrendChart';
export { XPProgressChart } from './XPProgressChart';
export { StepsChart } from './StepsChart';
export { MuscleDistributionChart } from './MuscleDistributionChart';
export { StreakCalendar } from './StreakCalendar';

// Date Utilities
export {
  parseISO,
  formatDate,
  startOfMonth,
  getDaysInMonth,
  getDay,
  addDays,
  isSameDay,
  differenceInDays,
} from './dateUtils';

// Default export for convenience
export { default as ThemedChart } from './ThemedChart';
