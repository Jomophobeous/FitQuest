/**
 * Analytics Data Service Stub
 * Provides data fetching for the analytics screen.
 * Returns empty/default data — will be rebuilt from FitQ backup.
 */

export interface BarData {
  day: string;
  count: number;
  label: string;
  value: number;
}

export interface MuscleGroupData {
  name: string;
  icon: string;
  sessions: number;
  muscle: string;
  count: number;
  percentage: number;
}

export interface StepStats {
  steps: number;
  distance: number;
  calories: number;
  avgDaily: number;
}

export interface JogStats {
  runs: number;
  totalKm: number;
  avgPace: string;
  longestRun: number;
}

export interface PersonalRecord {
  exercise: string;
  icon: string;
  value: string;
  date: string;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalWorkouts: number;
  consistencyPct: number;
  thisWeek: number;
  thisMonth: number;
}

export interface DaySession {
  id: string;
  date: string;
  started_at: string;
  success: boolean;
  duration_minutes: number;
  completed_exercises: number;
  total_exercises: number;
  exercises: string[];
  duration: number;
  xp: number;
}

export async function fetchWorkoutBars(_range: string): Promise<BarData[]> {
  return [];
}

export async function fetchXPData(_range: string): Promise<number[]> {
  return [];
}

export async function fetchMuscleGroups(_range?: string): Promise<MuscleGroupData[]> {
  return [];
}

export async function fetchStepStats(_range?: string): Promise<StepStats> {
  return { steps: 0, distance: 0, calories: 0, avgDaily: 0 };
}

export async function fetchJogStats(_range?: string): Promise<JogStats> {
  return { runs: 0, totalKm: 0, avgPace: '--:--', longestRun: 0 };
}

export async function fetchActiveDays(_range?: string): Promise<number[]> {
  return [];
}

export async function fetchPersonalRecords(): Promise<PersonalRecord[]> {
  return [];
}

export async function fetchStreakData(): Promise<StreakData> {
  return { currentStreak: 0, longestStreak: 0, totalWorkouts: 0, consistencyPct: 0, thisWeek: 0, thisMonth: 0 };
}

export async function fetchDaySessions(_date: string): Promise<DaySession[]> {
  return [];
}
