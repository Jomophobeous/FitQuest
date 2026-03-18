import { describe, expect, it } from 'vitest';

import { redactForLog } from '../src/services/logger';

describe('logger redaction', () => {
  it('redacts sensitive keys recursively', () => {
    const payload = {
      token: 'abcd1234efgh5678',
      nested: {
        refreshToken: 'refresh-value-12345',
        safe: 'hello-world',
      },
      list: [{ password: 'test1234' }],
    };

    const redacted = redactForLog(payload);
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.nested.refreshToken).toBe('[REDACTED]');
    expect(redacted.nested.safe).toContain('***');
    expect(redacted.list[0]!.password).toBe('[REDACTED]');
  });

  it('keeps shape for primitive values', () => {
    expect(redactForLog(10)).toBe(10);
    expect(redactForLog(true)).toBe(true);
  });
});
