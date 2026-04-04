/**
 * Tests: AES Encryption Module
 *
 * Target: src/security/AESEncryption.ts
 * Dependencies: expo-crypto (mocked with real Node.js crypto), expo-secure-store (mocked in-memory)
 * Coverage: V2 encrypt/decrypt roundtrip, V3 encrypt/decrypt roundtrip,
 *           payload version detection, tamper detection, master key management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  encryptV2,
  decryptV2,
  encryptV3,
  decryptV3,
  isV1Payload,
  isV2Payload,
  isV3Payload,
  getOrCreateMasterKey,
} from '../../src/security/AESEncryption';
import { __reset as resetSecureStore } from '../__mocks__/expo-secure-store';

// Use a deterministic test key (64-char hex = 256 bits)
const TEST_MASTER_KEY = 'a'.repeat(64);

beforeEach(() => {
  resetSecureStore();
});

// ============================================
// V2: CTR + HMAC-SHA256 (Encrypt-then-MAC)
// ============================================

describe('V2 Encryption (CTR + HMAC)', () => {
  it('encrypts and decrypts a simple string', async () => {
    const plaintext = 'Hello, FitQuest!';
    const payload = await encryptV2(plaintext, TEST_MASTER_KEY);
    const decrypted = await decryptV2(payload, TEST_MASTER_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it('encrypts and decrypts an empty string', async () => {
    const payload = await encryptV2('', TEST_MASTER_KEY);
    const decrypted = await decryptV2(payload, TEST_MASTER_KEY);
    expect(decrypted).toBe('');
  });

  it('encrypts and decrypts JSON data', async () => {
    const data = JSON.stringify({ heart_rate: 72, timestamp: Date.now() });
    const payload = await encryptV2(data, TEST_MASTER_KEY);
    const decrypted = await decryptV2(payload, TEST_MASTER_KEY);
    expect(JSON.parse(decrypted)).toEqual(JSON.parse(data));
  });

  it('encrypts and decrypts Unicode text', async () => {
    const plaintext = '🏋️ Workout complete! 你好世界';
    const payload = await encryptV2(plaintext, TEST_MASTER_KEY);
    const decrypted = await decryptV2(payload, TEST_MASTER_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it('produces a v2 payload structure', async () => {
    const payload = await encryptV2('test', TEST_MASTER_KEY);
    expect(payload.v).toBe(2);
    expect(payload.ct).toBeDefined();
    expect(payload.iv).toBeDefined();
    expect(payload.tag).toBeDefined();
    expect(payload.salt).toBeDefined();
  });

  it('produces unique ciphertext per encryption (random IV)', async () => {
    const a = await encryptV2('same', TEST_MASTER_KEY);
    const b = await encryptV2('same', TEST_MASTER_KEY);
    expect(a.ct).not.toBe(b.ct);
    expect(a.iv).not.toBe(b.iv);
  });

  it('detects tampered ciphertext (HMAC verification)', async () => {
    const payload = await encryptV2('secret data', TEST_MASTER_KEY);
    // Tamper with the ciphertext
    const tampered = { ...payload, ct: payload.ct.slice(0, -4) + 'XXXX' };
    await expect(decryptV2(tampered, TEST_MASTER_KEY)).rejects.toThrow(/[Aa]uthentication failed/);
  });

  it('rejects decryption with wrong key', async () => {
    const payload = await encryptV2('confidential', TEST_MASTER_KEY);
    const wrongKey = 'b'.repeat(64);
    await expect(decryptV2(payload, wrongKey)).rejects.toThrow(/[Aa]uthentication failed/);
  });
});

// ============================================
// V3: AES-256-GCM (@noble/ciphers)
// ============================================

describe('V3 Encryption (AES-256-GCM)', () => {
  it('encrypts and decrypts a simple string', async () => {
    const plaintext = 'Hello, FitQuest V3!';
    const payload = await encryptV3(plaintext, TEST_MASTER_KEY);
    const decrypted = await decryptV3(payload, TEST_MASTER_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it('encrypts and decrypts an empty string', async () => {
    const payload = await encryptV3('', TEST_MASTER_KEY);
    const decrypted = await decryptV3(payload, TEST_MASTER_KEY);
    expect(decrypted).toBe('');
  });

  it('encrypts and decrypts JSON health data', async () => {
    const data = JSON.stringify({
      type: 'heart_rate',
      bpm: 68,
      reading_type: 'RESTING',
      timestamp: 1700000000000,
    });
    const payload = await encryptV3(data, TEST_MASTER_KEY);
    const decrypted = await decryptV3(payload, TEST_MASTER_KEY);
    expect(JSON.parse(decrypted)).toEqual(JSON.parse(data));
  });

  it('encrypts and decrypts Unicode text', async () => {
    const plaintext = '🧠 FitMind reading session — 45 min';
    const payload = await encryptV3(plaintext, TEST_MASTER_KEY);
    const decrypted = await decryptV3(payload, TEST_MASTER_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it('produces a v3 payload structure', async () => {
    const payload = await encryptV3('test', TEST_MASTER_KEY);
    expect(payload.v).toBe(3);
    expect(payload.ct).toBeDefined();
    expect(payload.iv).toBeDefined();
    expect(payload.salt).toBeDefined();
    // V3 has no separate tag — GCM appends it to ciphertext
    expect((payload as any).tag).toBeUndefined();
  });

  it('produces unique ciphertext per encryption', async () => {
    const a = await encryptV3('same', TEST_MASTER_KEY);
    const b = await encryptV3('same', TEST_MASTER_KEY);
    expect(a.ct).not.toBe(b.ct);
  });

  it('detects tampered ciphertext (GCM built-in auth)', async () => {
    const payload = await encryptV3('secret', TEST_MASTER_KEY);
    const tampered = { ...payload, ct: payload.ct.slice(0, -4) + 'XXXX' };
    await expect(decryptV3(tampered, TEST_MASTER_KEY)).rejects.toThrow();
  });

  it('rejects decryption with wrong key', async () => {
    const payload = await encryptV3('confidential', TEST_MASTER_KEY);
    const wrongKey = 'b'.repeat(64);
    await expect(decryptV3(payload, wrongKey)).rejects.toThrow();
  });
});

// ============================================
// PAYLOAD VERSION DETECTION
// ============================================

describe('Payload version detection', () => {
  it('detects v1 payload', () => {
    expect(isV1Payload({ ciphertext: 'abc', iv: 'def', hash: 'ghi' })).toBe(true);
  });

  it('rejects v2 as v1', () => {
    expect(isV1Payload({ v: 2, ct: 'a', iv: 'b', tag: 'c', salt: 'd' })).toBe(false);
  });

  it('rejects null/undefined as v1', () => {
    expect(isV1Payload(null)).toBeFalsy();
    expect(isV1Payload(undefined)).toBeFalsy();
  });

  it('detects v2 payload', async () => {
    const payload = await encryptV2('test', TEST_MASTER_KEY);
    expect(isV2Payload(payload)).toBeTruthy();
    expect(isV3Payload(payload)).toBeFalsy();
  });

  it('detects v3 payload', async () => {
    const payload = await encryptV3('test', TEST_MASTER_KEY);
    expect(isV3Payload(payload)).toBeTruthy();
    expect(isV2Payload(payload)).toBeFalsy();
  });

  it('rejects incomplete objects', () => {
    expect(isV2Payload({ v: 2 })).toBeFalsy();
    expect(isV3Payload({ v: 3 })).toBeFalsy();
    expect(isV2Payload({})).toBeFalsy();
    expect(isV3Payload(null)).toBeFalsy();
  });
});

// ============================================
// MASTER KEY MANAGEMENT
// ============================================

describe('Master key management', () => {
  it('generates and returns a master key', async () => {
    const key = await getOrCreateMasterKey();
    expect(key).toBeDefined();
    expect(typeof key).toBe('string');
    expect(key.length).toBe(64); // 256 bits = 32 bytes = 64 hex chars
  });

  it('returns the same key on second call (idempotent)', async () => {
    const key1 = await getOrCreateMasterKey();
    const key2 = await getOrCreateMasterKey();
    expect(key1).toBe(key2);
  });

  it('generated key works for V2 encrypt/decrypt', async () => {
    const key = await getOrCreateMasterKey();
    const payload = await encryptV2('test with generated key', key);
    const decrypted = await decryptV2(payload, key);
    expect(decrypted).toBe('test with generated key');
  });

  it('generated key works for V3 encrypt/decrypt', async () => {
    const key = await getOrCreateMasterKey();
    const payload = await encryptV3('test with generated key v3', key);
    const decrypted = await decryptV3(payload, key);
    expect(decrypted).toBe('test with generated key v3');
  });
});
