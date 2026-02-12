export interface AdaptiveTrainingProfile {
  userId: string;
  fatigueSensitivity: number;
  progressionAggressiveness: number;
  volumeTolerance: number;
  confidence: number;
  samples: number;
  updatedAt: number;
  rationale: string[];
}

export interface AdaptiveSessionInput {
  completedCount: number;
  totalCount: number;
  averageDifficulty: number;
}

const DEFAULT_PROFILE: Omit<AdaptiveTrainingProfile, 'userId'> = {
  fatigueSensitivity: 1,
  progressionAggressiveness: 1,
  volumeTolerance: 1,
  confidence: 0,
  samples: 0,
  updatedAt: 0,
  rationale: ['Using baseline training profile.'],
};

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function smooth(previous: number, next: number, alpha: number): number {
  return previous + (next - previous) * alpha;
}

export function getDefaultAdaptiveTrainingProfile(userId: string): AdaptiveTrainingProfile {
  return {
    userId,
    ...DEFAULT_PROFILE,
  };
}

function buildRationale(successRate: number, averageDifficulty: number): string[] {
  const notes: string[] = [];

  if (successRate < 0.7) {
    notes.push('Completion has dipped recently, so recovery and progression are made more conservative.');
  } else if (successRate > 0.9) {
    notes.push('Completion is consistently high, so progression is allowed to speed up.');
  } else {
    notes.push('Completion is stable, so adaptation remains moderate.');
  }

  if (averageDifficulty >= 8) {
    notes.push('Perceived effort is high, so fatigue sensitivity is increased.');
  } else if (averageDifficulty <= 5) {
    notes.push('Perceived effort is manageable, so volume tolerance can increase slightly.');
  }

  return notes;
}

export function deriveAdaptiveTrainingProfile(
  current: AdaptiveTrainingProfile,
  input: AdaptiveSessionInput,
  now = Date.now()
): AdaptiveTrainingProfile {
  const totalCount = Math.max(1, input.totalCount);
  const successRate = clamp(input.completedCount / totalCount, 0, 1);
  const averageDifficulty = clamp(input.averageDifficulty || 5, 1, 10);

  const successTarget = 0.82;
  const successDelta = successRate - successTarget;
  const normalizedDifficulty = averageDifficulty / 10;

  const targetFatigueSensitivity = clamp(
    1 + (successTarget - successRate) * 0.45 + (normalizedDifficulty - 0.6) * 0.2,
    0.8,
    1.25
  );

  const targetProgressionAggressiveness = clamp(
    1 + successDelta * 0.55 - (normalizedDifficulty - 0.65) * 0.15,
    0.8,
    1.25
  );

  const targetVolumeTolerance = clamp(
    1 + successDelta * 0.35 - (normalizedDifficulty - 0.6) * 0.2,
    0.8,
    1.2
  );

  const nextSamples = current.samples + 1;
  const alpha = clamp(0.18 + Math.min(nextSamples, 20) * 0.01, 0.18, 0.38);

  return {
    userId: current.userId,
    fatigueSensitivity: round2(smooth(current.fatigueSensitivity, targetFatigueSensitivity, alpha)),
    progressionAggressiveness: round2(
      smooth(current.progressionAggressiveness, targetProgressionAggressiveness, alpha)
    ),
    volumeTolerance: round2(smooth(current.volumeTolerance, targetVolumeTolerance, alpha)),
    confidence: round2(clamp(nextSamples / 20, 0, 1)),
    samples: nextSamples,
    updatedAt: now,
    rationale: buildRationale(successRate, averageDifficulty),
  };
}
