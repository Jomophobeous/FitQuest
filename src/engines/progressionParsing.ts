export function parseReps(reps: string): number {
  // Handle formats: "10", "8-12", "30s hold"
  const match = reps.match(/(\d+)/);
  return match ? parseInt(match[1]!, 10) : 0;
}

export function parseRepRange(reps: string): { min: number; max: number } {
  const parts = reps.match(/(\d+)(?:-(\d+))?/);
  if (!parts) return { min: 8, max: 12 };

  const min = parseInt(parts[1]!, 10);
  const max = parts[2] ? parseInt(parts[2], 10) : min;
  return { min, max };
}

export function formatRepRange(min: number, max: number): string {
  if (min === max) return `${min}`;
  return `${min}-${max}`;
}
