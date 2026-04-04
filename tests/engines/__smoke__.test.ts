import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/database/service', () => ({
  recordProgress: vi.fn(),
  getProgressExerciseIds: vi.fn().mockResolvedValue([]),
  getProgressHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../src/services/adaptiveTrainingService', () => ({
  getAdaptiveTrainingProfile: vi.fn().mockResolvedValue({
    userId: 'test', fatigueSensitivity: 1, progressionAggressiveness: 1,
    volumeTolerance: 1, confidence: 0, samples: 0, updatedAt: Date.now(), rationale: [],
  }),
}));

vi.mock('../../src/security/randomId', () => ({
  generateSecureId: vi.fn().mockResolvedValue('test_id'),
}));

import { PROGRESSION_CONFIG } from '../../src/engines/progressionEngine';

describe('smoke: progressionEngine import', () => {
  it('loads PROGRESSION_CONFIG', () => {
    expect(PROGRESSION_CONFIG).toBeDefined();
    expect(PROGRESSION_CONFIG.success_threshold).toBe(0.9);
  });
});
