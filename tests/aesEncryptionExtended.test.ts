/**
 * Extended AES Encryption Tests
 *
 * Covers scenarios not in the base aesEncryption.test.ts:
 * - Large payload encryption
 * - Unicode and special character handling
 * - V3 encrypt/decrypt round-trips (comprehensive)
 * - V2 ↔ V3 cross-version checks
 * - Empty string encryption
 * - JSON payload preservation
 * - Multiple sequential encryptions
 */
import { describe, expect, it } from 'vitest';

(globalThis as any).__DEV__ = false;

import {
  encryptV2,
  decryptV2,
  encryptV3,
  decryptV3,
  isV2Payload,
  isV3Payload,
  getOrCreateMasterKey,
} from '../src/security/AESEncryption';

describe('AES Encryption Extended', () => {
  describe('V3 Encrypt/Decrypt', () => {
    it('round-trips short text via v3', async () => {
      const key = await getOrCreateMasterKey();
      const plaintext = 'Quick test for AES-256-GCM';
      const enc = await encryptV3(plaintext, key);
      expect(enc.v).toBe(3);
      const dec = await decryptV3(enc, key);
      expect(dec).toBe(plaintext);
    });

    it('round-trips large payload (~100KB)', async () => {
      const key = await getOrCreateMasterKey();
      const plaintext = 'A'.repeat(100_000);
      const enc = await encryptV3(plaintext, key);
      const dec = await decryptV3(enc, key);
      expect(dec).toBe(plaintext);
      expect(dec.length).toBe(100_000);
    });

    it('round-trips JSON health data', async () => {
      const key = await getOrCreateMasterKey();
      const data = {
        heartRate: 72,
        sleepHours: 7.5,
        steps: 8500,
        bloodPressure: '120/80',
        medications: ['vitamin D', 'omega-3'],
        notes: 'Good workout today – felt 💪 strong!',
        timestamp: Date.now(),
      };
      const plaintext = JSON.stringify(data);
      const enc = await encryptV3(plaintext, key);
      const dec = await decryptV3(enc, key);
      expect(JSON.parse(dec)).toEqual(data);
    });

    it('round-trips unicode and emoji', async () => {
      const key = await getOrCreateMasterKey();
      const plaintext = '💪 Workout complete! Ñoño résumé café ☕ 他好';
      const enc = await encryptV3(plaintext, key);
      const dec = await decryptV3(enc, key);
      expect(dec).toBe(plaintext);
    });

    it('round-trips empty string', async () => {
      const key = await getOrCreateMasterKey();
      const enc = await encryptV3('', key);
      const dec = await decryptV3(enc, key);
      expect(dec).toBe('');
    });

    it('produces different ciphertext each time (random IV)', async () => {
      const key = await getOrCreateMasterKey();
      const plaintext = 'Same text for randomness test';
      const enc1 = await encryptV3(plaintext, key);
      const enc2 = await encryptV3(plaintext, key);
      // Different IVs → different ciphertexts
      expect(enc1.iv).not.toBe(enc2.iv);
      expect(enc1.ct).not.toBe(enc2.ct);
      // But both decrypt to same plaintext
      expect(await decryptV3(enc1, key)).toBe(plaintext);
      expect(await decryptV3(enc2, key)).toBe(plaintext);
    });

    it('v3 payload is NOT detected as v2', async () => {
      const key = await getOrCreateMasterKey();
      const enc = await encryptV3('test', key);
      expect(isV3Payload(enc)).toBeTruthy();
      expect(isV2Payload(enc)).toBeFalsy();
    });
  });

  describe('V2 → V3 cross-version', () => {
    it('v2 and v3 encrypt to structurally different payloads', async () => {
      const key = await getOrCreateMasterKey();
      const plaintext = 'Cross-version test';
      const v2enc = await encryptV2(plaintext, key);
      const v3enc = await encryptV3(plaintext, key);

      expect(v2enc.v).toBe(2);
      expect(v3enc.v).toBe(3);
      // V2 has 'tag' field, V3 does not (GCM embeds it)
      expect('tag' in v2enc).toBe(true);
    });

    it('v2 encrypted data cannot be decrypted with v3', async () => {
      const key = await getOrCreateMasterKey();
      const plaintext = 'Do not cross the streams';
      const v2enc = await encryptV2(plaintext, key);

      await expect(decryptV3(v2enc as any, key)).rejects.toThrow();
    });

    it('v3 encrypted data cannot be decrypted with v2', async () => {
      const key = await getOrCreateMasterKey();
      const plaintext = 'Do not cross the streams';
      const v3enc = await encryptV3(plaintext, key);

      await expect(decryptV2(v3enc as any, key)).rejects.toThrow();
    });
  });

  describe('sequential operations', () => {
    it('encrypts and decrypts multiple items in sequence', async () => {
      const key = await getOrCreateMasterKey();
      const items = [
        'First health record',
        'Second health record with longer content and special chars: <>&"',
        JSON.stringify({ hr: 75, steps: 10000 }),
        '🏃‍♂️ 5K run completed in 25:30',
        'x'.repeat(50_000),
      ];

      for (const plaintext of items) {
        const enc = await encryptV3(plaintext, key);
        const dec = await decryptV3(enc, key);
        expect(dec).toBe(plaintext);
      }
    });
  });

  describe('key consistency', () => {
    it('same master key decrypts all payloads', async () => {
      const key1 = await getOrCreateMasterKey();
      const enc1 = await encryptV3('msg1', key1);
      const enc2 = await encryptV3('msg2', key1);

      const key2 = await getOrCreateMasterKey();
      expect(key1).toBe(key2); // Same key returned

      expect(await decryptV3(enc1, key2)).toBe('msg1');
      expect(await decryptV3(enc2, key2)).toBe('msg2');
    });
  });
});
