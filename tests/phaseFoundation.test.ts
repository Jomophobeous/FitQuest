import { describe, expect, it } from 'vitest';

import {
  getOverallFoundationCompletion,
  getPhaseStatus,
  PHASE_FOUNDATION_STATUSES,
} from '../src/platform/phaseFoundation';

describe('phase foundation status model', () => {
  it('covers phases 1 through 10', () => {
    expect(PHASE_FOUNDATION_STATUSES).toHaveLength(10);
    expect(getPhaseStatus(1)?.name).toContain('Local');
    expect(getPhaseStatus(10)?.name).toContain('Enterprise');
  });

  it('computes overall completion in a valid range', () => {
    const overall = getOverallFoundationCompletion();
    expect(overall).toBeGreaterThanOrEqual(0);
    expect(overall).toBeLessThanOrEqual(100);
  });
});
