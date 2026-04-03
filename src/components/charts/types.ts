/**
 * Chart Types
 *
 * Shared type definitions for Victory-native based chart components.
 */

import { darkTheme as theme } from '../../design/theme-system';

// ============================================
// DATA POINT TYPES
// ============================================

export interface TimeSeriesPoint {
  date: Date | string;
  value: number;
}

export interface LabeledDataPoint {
  x: string | number | Date;
  y: number;
  label?: string;
}

export interface WorkoutDataPoint {
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  exerciseCount: number;
  isDeload?: boolean;
}

export interface XPDataPoint {
  date: string;
  totalXP: number;
  deltaXP: number; // XP gained that day
}

export interface StepDataPoint {
  date: string;
  steps: number;
  goal: number;
  metGoal: boolean;
}

export interface HeartRateDataPoint {
  timestamp: string;
  bpm: number;
  zone: HeartRateZone;
}

export interface SleepDataPoint {
  date: string;
  durationHours: number;
  quality: number; // 0-100
  deepSleepPercent: number;
  remSleepPercent: number;
}

export interface MuscleGroupDataPoint {
  muscle: string;
  sets: number;
  percentage: number;
}

export interface StreakDay {
  date: string; // YYYY-MM-DD
  completed: boolean;
  workoutId?: string;
}

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type DateRangeOption = '7d' | '30d' | '90d' | '1y' | 'all';

export type HeartRateZone = 'rest' | 'fat_burn' | 'cardio' | 'peak' | 'max';

export const DATE_RANGE_LABELS: Record<DateRangeOption, string> = {
  '7d': '7 Days',
  '30d': '30 Days',
  '90d': '90 Days',
  '1y': '1 Year',
  all: 'All Time',
};

export const HEART_RATE_ZONE_COLORS: Record<HeartRateZone, string> = {
  rest: theme.colors.textMuted, // Gray
  fat_burn: theme.colors.accent, // Emerald
  cardio: theme.colors.warning, // Amber
  peak: theme.colors.error, // Red
  max: theme.colors.error, // Dark Red
};

export const MUSCLE_GROUP_COLORS: string[] = [
  theme.colors.accent, // Emerald
  theme.colors.info, // Blue
  theme.colors.purple, // Violet
  theme.colors.warning, // Amber
  theme.colors.pink, // Pink
  theme.colors.info, // Cyan
  theme.colors.accent, // Lime
  theme.colors.orange, // Orange
];

// ============================================
// CHART CONFIGURATION
// ============================================

export interface ChartConfig {
  animate?: boolean;
  animationDuration?: number;
  showGrid?: boolean;
  showAxis?: boolean;
  showTooltip?: boolean;
  height?: number;
  padding?: { top: number; bottom: number; left: number; right: number };
}

export const DEFAULT_CHART_CONFIG: ChartConfig = {
  animate: true,
  animationDuration: 400,
  showGrid: true,
  showAxis: true,
  showTooltip: true,
  height: 220,
  padding: { top: 20, bottom: 40, left: 50, right: 20 },
};

// ============================================
// THEME COLORS
// ============================================

export interface ChartThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  grid: string;
  axis: string;
}

export const DARK_CHART_THEME: ChartThemeColors = {
  primary: theme.colors.accent,
  secondary: theme.colors.info,
  accent: theme.colors.purple,
  success: theme.colors.accent,
  warning: theme.colors.warning,
  error: theme.colors.error,
  background: theme.colors.background,
  surface: theme.colors.surface,
  text: theme.colors.text,
  textMuted: theme.colors.textSecondary,
  grid: 'rgba(255, 255, 255, 0.1)',
  axis: theme.colors.textMuted,
};

export const LIGHT_CHART_THEME: ChartThemeColors = {
  primary: theme.colors.accentDark,
  secondary: theme.colors.info,
  accent: theme.colors.purple,
  success: theme.colors.accentDark,
  warning: theme.colors.warning,
  error: theme.colors.error,
  background: theme.colors.text,
  surface: theme.colors.onAccent,
  text: theme.colors.background,
  textMuted: theme.colors.textMuted,
  grid: 'rgba(0, 0, 0, 0.1)',
  axis: theme.colors.textSecondary,
};

// ============================================
// PROPS INTERFACES
// ============================================

export interface BaseChartProps {
  config?: Partial<ChartConfig>;
  dateRange?: DateRangeOption;
  onDataPointPress?: (point: LabeledDataPoint, index: number) => void;
}

export interface WorkoutTrendChartProps extends BaseChartProps {
  data: WorkoutDataPoint[];
  showExerciseCount?: boolean;
}

export interface XPProgressChartProps extends BaseChartProps {
  data: XPDataPoint[];
  showDelta?: boolean;
}

export interface StepsChartProps extends BaseChartProps {
  data: StepDataPoint[];
  showGoal?: boolean;
}

export interface HeartRateChartProps extends BaseChartProps {
  data: HeartRateDataPoint[];
  targetZone?: HeartRateZone;
}

export interface SleepChartProps extends BaseChartProps {
  data: SleepDataPoint[];
  showStages?: boolean;
}

export interface MuscleDistributionChartProps extends BaseChartProps {
  data: MuscleGroupDataPoint[];
  chartType?: 'pie' | 'bar';
}

export interface StreakCalendarProps {
  data: StreakDay[];
  month: number; // 0-11
  year: number;
  onDayPress?: (day: StreakDay) => void;
}
