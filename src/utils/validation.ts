/**
 * FitQuest Input Validation Utilities
 *
 * Centralised validation for all user inputs. Pure functions, no side effects.
 * Use these in every screen with TextInput or free-form entry.
 */

// ============================================
// NUMERIC VALIDATORS
// ============================================

export interface NumericRange {
  min: number;
  max: number;
  label: string;
}

/** Standard physiological ranges for body stats */
export const BODY_RANGES = {
  weightKg: { min: 20, max: 500, label: 'Weight (kg)' } as NumericRange,
  heightCm: { min: 50, max: 300, label: 'Height (cm)' } as NumericRange,
  age: { min: 5, max: 120, label: 'Age' } as NumericRange,
  waistCm: { min: 30, max: 250, label: 'Waist (cm)' } as NumericRange,
  neckCm: { min: 20, max: 80, label: 'Neck (cm)' } as NumericRange,
  hipCm: { min: 40, max: 200, label: 'Hip (cm)' } as NumericRange,
  heartRate: { min: 20, max: 250, label: 'Heart rate (bpm)' } as NumericRange,
  reps: { min: 1, max: 999, label: 'Reps' } as NumericRange,
  sets: { min: 1, max: 50, label: 'Sets' } as NumericRange,
  servings: { min: 0.5, max: 99, label: 'Servings' } as NumericRange,
} as const;

export interface ValidationResult {
  valid: boolean;
  value: number;
  error?: string;
}

/**
 * Validate a numeric string against a range.
 * Returns the parsed number if valid, or an error message.
 */
export function validateNumeric(raw: string, range: NumericRange, required = true): ValidationResult {
  const trimmed = raw.trim();

  if (!trimmed) {
    if (required) {
      return { valid: false, value: 0, error: `${range.label} is required` };
    }
    return { valid: true, value: 0 };
  }

  const num = Number(trimmed);

  if (!Number.isFinite(num)) {
    return { valid: false, value: 0, error: `${range.label} must be a number` };
  }

  if (num < range.min) {
    return {
      valid: false,
      value: num,
      error: `${range.label} must be at least ${range.min}`,
    };
  }

  if (num > range.max) {
    return {
      valid: false,
      value: num,
      error: `${range.label} must be at most ${range.max}`,
    };
  }

  return { valid: true, value: num };
}

/**
 * Clamp a numeric value to a range (for stepper-style inputs).
 */
export function clampNumeric(value: number, range: NumericRange): number {
  return Math.max(range.min, Math.min(range.max, value));
}

// ============================================
// STRING VALIDATORS
// ============================================

/**
 * Sanitise user-entered text: trim, collapse whitespace, strip control chars.
 * Does NOT strip HTML — use sanitizeForStorage() if content may be rendered.
 */
export function sanitizeText(raw: string, maxLength = 500): string {
  return raw
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
    .replace(/\s+/g, ' ') // collapse whitespace
    .slice(0, maxLength);
}

/**
 * Sanitise text that may eventually be rendered in a WebView or HTML context.
 * Strips angle brackets and common injection vectors.
 */
export function sanitizeForStorage(raw: string, maxLength = 10000): string {
  return raw
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/<[^>]*>/g, '') // strip HTML tags
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .slice(0, maxLength);
}

// ============================================
// EMAIL VALIDATOR
// ============================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Validate email format. Not exhaustive (RFC 5322 is complex),
 * but catches the most common malformed addresses.
 */
export function validateEmail(raw: string): { valid: boolean; email: string; error?: string } {
  const email = raw.trim().toLowerCase();

  if (!email) {
    return { valid: false, email, error: 'Email is required' };
  }

  if (email.length > 254) {
    return { valid: false, email, error: 'Email is too long' };
  }

  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, email, error: 'Enter a valid email address' };
  }

  return { valid: true, email };
}

// ============================================
// PASSWORD VALIDATOR
// ============================================

export interface PasswordStrength {
  valid: boolean;
  score: number; // 0-4
  errors: string[];
}

/**
 * Validate password strength with multiple criteria.
 */
export function validatePassword(password: string): PasswordStrength {
  const errors: string[] = [];
  let score = 0;

  if (password.length < 8) {
    errors.push('At least 8 characters required');
  } else {
    score++;
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Include an uppercase letter');
  } else {
    score++;
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Include a number');
  } else {
    score++;
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Include a special character');
  } else {
    score++;
  }

  return { valid: errors.length === 0, score, errors };
}

// ============================================
// NAME VALIDATOR
// ============================================

/**
 * Validate a user display name.
 */
export function validateName(raw: string): { valid: boolean; name: string; error?: string } {
  const name = sanitizeText(raw, 100);

  if (!name) {
    return { valid: false, name, error: 'Name is required' };
  }

  if (name.length < 2) {
    return { valid: false, name, error: 'Name must be at least 2 characters' };
  }

  return { valid: true, name };
}
