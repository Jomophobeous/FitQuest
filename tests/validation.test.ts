import { describe, expect, it } from 'vitest';
import {
  validateNumeric,
  validateEmail,
  validatePassword,
  validateName,
  sanitizeText,
  sanitizeForStorage,
  clampNumeric,
  BODY_RANGES,
} from '../src/utils/validation';

// ============================================
// NUMERIC VALIDATION
// ============================================

describe('validateNumeric', () => {
  it('accepts valid numbers within range', () => {
    const r = validateNumeric('75', BODY_RANGES.weightKg);
    expect(r.valid).toBe(true);
    expect(r.value).toBe(75);
    expect(r.error).toBeUndefined();
  });

  it('rejects empty required fields', () => {
    const r = validateNumeric('', BODY_RANGES.weightKg, true);
    expect(r.valid).toBe(false);
    expect(r.error).toContain('required');
  });

  it('accepts empty optional fields', () => {
    const r = validateNumeric('', BODY_RANGES.weightKg, false);
    expect(r.valid).toBe(true);
  });

  it('rejects non-numeric input', () => {
    const r = validateNumeric('abc', BODY_RANGES.weightKg);
    expect(r.valid).toBe(false);
    expect(r.error).toContain('must be a number');
  });

  it('rejects values below minimum', () => {
    const r = validateNumeric('5', BODY_RANGES.weightKg); // min 20
    expect(r.valid).toBe(false);
    expect(r.error).toContain('at least 20');
  });

  it('rejects values above maximum', () => {
    const r = validateNumeric('999', BODY_RANGES.weightKg); // max 500
    expect(r.valid).toBe(false);
    expect(r.error).toContain('at most 500');
  });

  it('rejects NaN from parseFloat edge cases', () => {
    expect(validateNumeric('12abc', BODY_RANGES.weightKg).valid).toBe(false);
    expect(validateNumeric('Infinity', BODY_RANGES.weightKg).valid).toBe(false);
    expect(validateNumeric('-Infinity', BODY_RANGES.weightKg).valid).toBe(false);
  });

  it('accepts boundary values', () => {
    expect(validateNumeric('20', BODY_RANGES.weightKg).valid).toBe(true);
    expect(validateNumeric('500', BODY_RANGES.weightKg).valid).toBe(true);
  });
});

describe('clampNumeric', () => {
  it('clamps below minimum', () => {
    expect(clampNumeric(5, BODY_RANGES.weightKg)).toBe(20);
  });

  it('clamps above maximum', () => {
    expect(clampNumeric(999, BODY_RANGES.weightKg)).toBe(500);
  });

  it('passes through in-range values', () => {
    expect(clampNumeric(75, BODY_RANGES.weightKg)).toBe(75);
  });
});

// ============================================
// EMAIL VALIDATION
// ============================================

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com').valid).toBe(true);
    expect(validateEmail(' User@EXAMPLE.com ').email).toBe('user@example.com');
  });

  it('rejects empty email', () => {
    expect(validateEmail('').valid).toBe(false);
    expect(validateEmail('   ').valid).toBe(false);
  });

  it('rejects emails without TLD', () => {
    expect(validateEmail('user@localhost').valid).toBe(false);
  });

  it('rejects just an @ sign', () => {
    expect(validateEmail('@').valid).toBe(false);
  });

  it('rejects multiple @ signs', () => {
    expect(validateEmail('a@b@c.com').valid).toBe(false);
  });
});

// ============================================
// PASSWORD VALIDATION
// ============================================

describe('validatePassword', () => {
  it('rejects short passwords', () => {
    const r = validatePassword('Aa1!');
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('At least 8 characters required');
  });

  it('requires uppercase', () => {
    const r = validatePassword('abcd1234!');
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('Include an uppercase letter');
  });

  it('requires number', () => {
    const r = validatePassword('Abcdefgh!');
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('Include a number');
  });

  it('requires special character', () => {
    const r = validatePassword('Abcdefg1');
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('Include a special character');
  });

  it('accepts strong passwords with score 4', () => {
    const r = validatePassword('Str0ng!Pa$$');
    expect(r.valid).toBe(true);
    expect(r.score).toBe(4);
  });
});

// ============================================
// NAME VALIDATION
// ============================================

describe('validateName', () => {
  it('accepts valid names', () => {
    expect(validateName('John Doe').valid).toBe(true);
  });

  it('rejects empty names', () => {
    expect(validateName('').valid).toBe(false);
  });

  it('rejects single-char names', () => {
    expect(validateName('J').valid).toBe(false);
  });

  it('trims and sanitizes', () => {
    const r = validateName('  John  ');
    expect(r.valid).toBe(true);
    expect(r.name).toBe('John');
  });
});

// ============================================
// SANITIZERS
// ============================================

describe('sanitizeText', () => {
  it('trims and collapses whitespace', () => {
    expect(sanitizeText('  hello   world  ')).toBe('hello world');
  });

  it('strips control characters', () => {
    expect(sanitizeText('hello\x00\x01world')).toBe('helloworld');
  });

  it('respects maxLength', () => {
    const long = 'a'.repeat(1000);
    expect(sanitizeText(long, 50).length).toBe(50);
  });
});

describe('sanitizeForStorage', () => {
  it('strips HTML tags', () => {
    expect(sanitizeForStorage('<script>alert("xss")</script>Hello')).toBe('alert("xss")Hello');
  });

  it('strips javascript: protocol', () => {
    expect(sanitizeForStorage('javascript:alert(1)')).toBe('alert(1)');
  });

  it('strips event handlers', () => {
    expect(sanitizeForStorage('onerror=alert(1)')).toBe('alert(1)');
  });
});
