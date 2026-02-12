import { describe, expect, it } from 'vitest';

import {
  deriveAdaptiveTrainingProfile,
  getDefaultAdaptiveTrainingProfile,
} from '../src/services/adaptiveTrainingMath';

describe('adaptiveTrainingService profile derivation', () => {
  it('increases progression on strong outcomes', () => {
    const current = getDefaultAdaptiveTrainingProfile('user_local_001');
    const next = deriveAdaptiveTrainingProfile(
      current,
      {
        completedCount: 6,
        totalCount: 6,
        averageDifficulty: 4,
      },
      1000
    );

    expect(next.progressionAggressiveness).toBeGreaterThanOrEqual(current.progressionAggressiveness);
    expect(next.volumeTolerance).toBeGreaterThanOrEqual(current.volumeTolerance);
    expect(next.samples).toBe(1);
    expect(next.updatedAt).toBe(1000);
  });

  it('increases fatigue sensitivity on difficult low-success sessions', () => {
    const current = getDefaultAdaptiveTrainingProfile('user_local_001');
    const next = deriveAdaptiveTrainingProfile(
      current,
      {
        completedCount: 1,
        totalCount: 6,
        averageDifficulty: 9,
      },
      2000
    );

    expect(next.fatigueSensitivity).toBeGreaterThanOrEqual(current.fatigueSensitivity);
    expect(next.progressionAggressiveness).toBeLessThanOrEqual(current.progressionAggressiveness);
    expect(next.rationale.length).toBeGreaterThan(0);
  });
});
