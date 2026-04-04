/**
 * Tests: randomId — secure ID generation
 *
 * Target: src/security/randomId.ts
 * Dependencies: expo-crypto (mocked with Node.js crypto)
 * Risk: LOW — simple async function
 */

import { describe, it, expect } from 'vitest';
import { generateSecureId } from '../../src/security/randomId';

describe('generateSecureId', () => {
  it('generates an ID with the given prefix', async () => {
    const id = await generateSecureId('progress');
    expect(id.startsWith('progress_')).toBe(true);
  });

  it('includes a timestamp component', async () => {
    const before = Date.now();
    const id = await generateSecureId('test');
    const after = Date.now();
    // Extract timestamp: prefix_TIMESTAMP_hex
    const parts = id.split('_');
    const timestamp = parseInt(parts[1]!, 10);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('generates unique IDs', async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      ids.add(await generateSecureId('uniq'));
    }
    expect(ids.size).toBe(50);
  });

  it('uses correct hex length for default byte size (8)', async () => {
    const id = await generateSecureId('pfx');
    const parts = id.split('_');
    // prefix_timestamp_hex → hex part should be 16 chars (8 bytes * 2)
    expect(parts[2]!.length).toBe(16);
  });

  it('respects custom byte length', async () => {
    const id = await generateSecureId('custom', 4);
    const parts = id.split('_');
    // 4 bytes * 2 = 8 hex chars
    expect(parts[2]!.length).toBe(8);
  });

  it('hex part contains only valid hex characters', async () => {
    const id = await generateSecureId('hex');
    const parts = id.split('_');
    expect(parts[2]).toMatch(/^[0-9a-f]+$/);
  });
});
