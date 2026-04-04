/**
 * Tests: progressionParsing — pure utility functions
 * 
 * Target: src/engines/progressionParsing.ts
 * Dependencies: NONE (pure functions)
 * Risk: LOW — no DB, no async, no side effects
 */

import { describe, it, expect } from 'vitest';
import { parseReps, parseRepRange, formatRepRange } from '../../src/engines/progressionParsing';

// ============================================
// parseReps
// ============================================

describe('parseReps', () => {
  it('parses a plain number string', () => {
    expect(parseReps('10')).toBe(10);
  });

  it('extracts first number from a range', () => {
    expect(parseReps('8-12')).toBe(8);
  });

  it('handles "30s hold" format', () => {
    expect(parseReps('30s hold')).toBe(30);
  });

  it('returns 0 for non-numeric input', () => {
    expect(parseReps('none')).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(parseReps('')).toBe(0);
  });

  it('parses single digit', () => {
    expect(parseReps('5')).toBe(5);
  });

  it('parses large numbers', () => {
    expect(parseReps('100')).toBe(100);
  });
});

// ============================================
// parseRepRange
// ============================================

describe('parseRepRange', () => {
  it('parses a range like "8-12"', () => {
    expect(parseRepRange('8-12')).toEqual({ min: 8, max: 12 });
  });

  it('parses a single number as min=max', () => {
    expect(parseRepRange('10')).toEqual({ min: 10, max: 10 });
  });

  it('returns default {8,12} for non-numeric input', () => {
    expect(parseRepRange('none')).toEqual({ min: 8, max: 12 });
  });

  it('returns default for empty string', () => {
    expect(parseRepRange('')).toEqual({ min: 8, max: 12 });
  });

  it('parses "3-5" correctly', () => {
    expect(parseRepRange('3-5')).toEqual({ min: 3, max: 5 });
  });

  it('handles range with surrounding text', () => {
    const result = parseRepRange('do 6-8 reps');
    expect(result.min).toBe(6);
    expect(result.max).toBe(8);
  });
});

// ============================================
// formatRepRange
// ============================================

describe('formatRepRange', () => {
  it('formats a range', () => {
    expect(formatRepRange(8, 12)).toBe('8-12');
  });

  it('formats equal min/max as single number', () => {
    expect(formatRepRange(10, 10)).toBe('10');
  });

  it('formats low range', () => {
    expect(formatRepRange(3, 5)).toBe('3-5');
  });

  it('formats high range', () => {
    expect(formatRepRange(15, 20)).toBe('15-20');
  });
});

// ============================================
// CROSS-FUNCTION INVARIANTS
// ============================================

describe('parseReps ↔ formatRepRange roundtrip', () => {
  it('formatRepRange output is parseable by parseRepRange', () => {
    const formatted = formatRepRange(6, 10);
    const parsed = parseRepRange(formatted);
    expect(parsed).toEqual({ min: 6, max: 10 });
  });

  it('single-value roundtrip', () => {
    const formatted = formatRepRange(12, 12);
    const parsed = parseRepRange(formatted);
    expect(parsed).toEqual({ min: 12, max: 12 });
  });
});
