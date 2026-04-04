/**
 * Mind Session Engine Stub
 * Provides mind/focus exercise session management.
 * Will be rebuilt from FitQ backup.
 */

export interface MindPhase {
  name: string;
  duration: number;
  instruction: string;
}

export interface MindTimeline {
  phases: MindPhase[];
  totalDuration: number;
}

export function isMindExercise(category: string): boolean {
  return category === 'focus';
}

export function getMindDuration(exerciseName: string, experience: string): number {
  if (experience === 'advanced') return 600;
  if (experience === 'intermediate') return 420;
  return 300;
}

export function generateMindTimeline(name: string, category: string, duration: number): MindTimeline {
  return {
    phases: [
      { name: 'Settle', duration: 30, instruction: 'Find a comfortable position and close your eyes.' },
      { name: 'Focus', duration: duration - 60, instruction: 'Focus on your breathing.' },
      { name: 'Return', duration: 30, instruction: 'Slowly bring your awareness back.' },
    ],
    totalDuration: duration,
  };
}

export function formatMindDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  return `${mins} min`;
}
