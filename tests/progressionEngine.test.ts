import { describe, expect, it } from 'vitest';

import { formatRepRange, parseReps, parseRepRange } from '../src/engines/progressionParsing';

describe('progressionEngine rep parsing', () => {
  it('parses single rep counts', () => {
    expect(parseReps('8')).toBe(8);
    expect(parseReps('10 reps')).toBe(10);
  });

  it('parses rep ranges', () => {
    expect(parseRepRange('8-12')).toEqual({ min: 8, max: 12 });
    expect(parseRepRange('10-15')).toEqual({ min: 10, max: 15 });
  });

  it('formats rep ranges', () => {
    expect(formatRepRange(6, 10)).toBe('6-10');
  });
});
