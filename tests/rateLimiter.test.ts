import { describe, expect, it, beforeEach } from 'vitest';
import { rateLimiter, RATE_LIMITS, formatRetryAfter } from '../src/utils/rateLimiter';

describe('rateLimiter', () => {
  beforeEach(() => {
    rateLimiter.clearAll();
  });

  it('allows requests under the limit', () => {
    const config = { maxAttempts: 3, windowMs: 60_000, lockoutMs: 0 };
    expect(rateLimiter.attempt('test', config).allowed).toBe(true);
    expect(rateLimiter.attempt('test', config).allowed).toBe(true);
    expect(rateLimiter.attempt('test', config).allowed).toBe(true);
  });

  it('blocks requests over the limit', () => {
    const config = { maxAttempts: 2, windowMs: 60_000, lockoutMs: 0 };
    rateLimiter.attempt('test', config);
    rateLimiter.attempt('test', config);
    const r = rateLimiter.attempt('test', config);
    expect(r.allowed).toBe(false);
    expect(r.remainingAttempts).toBe(0);
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });

  it('tracks remaining attempts correctly', () => {
    const config = { maxAttempts: 5, windowMs: 60_000, lockoutMs: 0 };
    const r1 = rateLimiter.attempt('test', config);
    expect(r1.remainingAttempts).toBe(4);
    rateLimiter.attempt('test', config);
    const r3 = rateLimiter.attempt('test', config);
    expect(r3.remainingAttempts).toBe(2);
  });

  it('peek does not consume attempts', () => {
    const config = { maxAttempts: 3, windowMs: 60_000, lockoutMs: 0 };
    rateLimiter.attempt('test', config);
    const peek = rateLimiter.peek('test', config);
    expect(peek.remainingAttempts).toBe(2);
    const peek2 = rateLimiter.peek('test', config);
    expect(peek2.remainingAttempts).toBe(2); // unchanged
  });

  it('reset clears the bucket', () => {
    const config = { maxAttempts: 1, windowMs: 60_000, lockoutMs: 0 };
    rateLimiter.attempt('test', config);
    expect(rateLimiter.attempt('test', config).allowed).toBe(false);
    rateLimiter.reset('test');
    expect(rateLimiter.attempt('test', config).allowed).toBe(true);
  });

  it('uses separate buckets per key', () => {
    const config = { maxAttempts: 1, windowMs: 60_000, lockoutMs: 0 };
    rateLimiter.attempt('key-a', config);
    expect(rateLimiter.attempt('key-a', config).allowed).toBe(false);
    expect(rateLimiter.attempt('key-b', config).allowed).toBe(true);
  });

  it('defines all required rate limit profiles', () => {
    expect(RATE_LIMITS.BIOMETRIC_AUTH).toBeDefined();
    expect(RATE_LIMITS.PASSCODE_AUTH).toBeDefined();
    expect(RATE_LIMITS.DATA_EXPORT).toBeDefined();
    expect(RATE_LIMITS.AI_QUERY).toBeDefined();
    expect(RATE_LIMITS.DESTRUCTIVE_OP).toBeDefined();
    expect(RATE_LIMITS.PROFILE_UPDATE).toBeDefined();
  });
});

describe('formatRetryAfter', () => {
  it('formats seconds', () => {
    expect(formatRetryAfter(5000)).toBe('5s');
    expect(formatRetryAfter(45_000)).toBe('45s');
  });

  it('formats minutes', () => {
    expect(formatRetryAfter(120_000)).toBe('2m');
    expect(formatRetryAfter(300_000)).toBe('5m');
  });

  it('formats hours', () => {
    expect(formatRetryAfter(3_600_000)).toBe('1h');
  });

  it('returns empty string for zero or negative', () => {
    expect(formatRetryAfter(0)).toBe('');
    expect(formatRetryAfter(-100)).toBe('');
  });
});
