import { describe, expect, it } from 'vitest';

// __DEV__ global (used by getOrCreateMasterKey)
(globalThis as any).__DEV__ = false;

import {
  encryptV2,
  decryptV2,
  encryptV3,
  decryptV3,
  isV1Payload,
  isV2Payload,
  isV3Payload,
  getOrCreateMasterKey,
} from '../src/security/AESEncryption';

describe('AES Encryption', () => {
  describe('Payload Version Detection', () => {
    it('detects v1 payload (legacy XOR format)', () => {
      expect(isV1Payload({ ciphertext: 'abc', iv: '123', hash: 'xyz' })).toBeTruthy();
    });

    it('rejects v2 payload as v1', () => {
      expect(isV1Payload({ v: 2, ct: 'abc', iv: '123', tag: 'xyz', salt: 'aaa' })).toBeFalsy();
    });

    it('rejects null as v1', () => {
      expect(isV1Payload(null)).toBeFalsy();
    });

    it('rejects undefined as v1', () => {
      expect(isV1Payload(undefined)).toBeFalsy();
    });

    it('detects v2 payload', () => {
      expect(isV2Payload({ v: 2, ct: 'abc', iv: '123', tag: 'xyz', salt: 'aaa' })).toBeTruthy();
    });

    it('rejects incomplete v2 payload', () => {
      expect(isV2Payload({ v: 2, ct: 'abc', iv: '123' })).toBeFalsy();
    });

    it('rejects v3 as v2', () => {
      expect(isV2Payload({ v: 3, ct: 'abc', iv: '123', salt: 'aaa' })).toBeFalsy();
    });

    it('detects v3 payload', () => {
      expect(isV3Payload({ v: 3, ct: 'abc', iv: '123', salt: 'aaa' })).toBeTruthy();
    });

    it('rejects incomplete v3 payload', () => {
      expect(isV3Payload({ v: 3, ct: 'abc' })).toBeFalsy();
    });

    it('rejects v2 as v3', () => {
      expect(isV3Payload({ v: 2, ct: 'abc', iv: '123', tag: 'xyz', salt: 'aaa' })).toBeFalsy();
    });

    it('rejects random objects', () => {
      expect(isV1Payload({ foo: 'bar' })).toBeFalsy();
      expect(isV2Payload({ foo: 'bar' })).toBeFalsy();
      expect(isV3Payload({ foo: 'bar' })).toBeFalsy();
    });
  });

  describe('Master Key Management', () => {
    it('generates and returns a master key', async () => {
      const key = await getOrCreateMasterKey();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });

    it('returns same key on subsequent calls', async () => {
      const key1 = await getOrCreateMasterKey();
      const key2 = await getOrCreateMasterKey();
      expect(key1).toBe(key2);
    });
  });

  describe('V2 Encrypt/Decrypt Round-Trip', () => {
    it('encrypts and decrypts short text', async () => {
      const masterKey = await getOrCreateMasterKey();
      const plaintext = 'Hello, FitQuest!';
      const encrypted = await encryptV2(plaintext, masterKey);

      expect(encrypted.v).toBe(2);
      expect(encrypted.ct).toBeTruthy();
      expect(encrypted.iv).toBeTruthy();
      expect(encrypted.tag).toBeTruthy();
      expect(encrypted.salt).toBeTruthy();

      const decrypted = await decryptV2(encrypted, masterKey);
      expect(decrypted).toBe(plaintext);
    });

    it('encrypts and decrypts longer content', async () => {
      const masterKey = await getOrCreateMasterKey();
      const plaintext = JSON.stringify({
        heart_rate: 72,
        blood_pressure: '120/80',
        sleep_hours: 7.5,
        notes: 'Felt well after morning workout',
      });
      const encrypted = await encryptV2(plaintext, masterKey);
      const decrypted = await decryptV2(encrypted, masterKey);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertext for same plaintext', async () => {
      const masterKey = await getOrCreateMasterKey();
      const plaintext = 'Same message twice';
      const enc1 = await encryptV2(plaintext, masterKey);
      const enc2 = await encryptV2(plaintext, masterKey);
      // Different IVs/salts → different ciphertexts
      expect(enc1.ct).not.toBe(enc2.ct);
      expect(enc1.iv).not.toBe(enc2.iv);
    });

    it('encrypted payload is type v2', async () => {
      const masterKey = await getOrCreateMasterKey();
      const encrypted = await encryptV2('test', masterKey);
      expect(isV2Payload(encrypted)).toBeTruthy();
      expect(isV3Payload(encrypted)).toBeFalsy();
      expect(isV1Payload(encrypted)).toBeFalsy();
    });
  });

  describe('V3 Encrypt/Decrypt Round-Trip', () => {
    it('encrypts and decrypts short text', async () => {
      const masterKey = await getOrCreateMasterKey();
      const plaintext = 'AES-256-GCM test';
      const encrypted = await encryptV3(plaintext, masterKey);

      expect(encrypted.v).toBe(3);
      expect(encrypted.ct).toBeTruthy();
      expect(encrypted.iv).toBeTruthy();
      expect(encrypted.salt).toBeTruthy();

      const decrypted = await decryptV3(encrypted, masterKey);
      expect(decrypted).toBe(plaintext);
    });

    it('encrypted payload is type v3', async () => {
      const masterKey = await getOrCreateMasterKey();
      const encrypted = await encryptV3('test', masterKey);
      expect(isV3Payload(encrypted)).toBeTruthy();
      expect(isV2Payload(encrypted)).toBeFalsy();
    });
  });

  describe('Tamper Detection', () => {
    it('detects tampered v2 ciphertext', async () => {
      const masterKey = await getOrCreateMasterKey();
      const encrypted = await encryptV2('secret data', masterKey);
      // Tamper with ciphertext
      encrypted.ct = encrypted.ct.slice(0, -2) + 'XX';
      await expect(decryptV2(encrypted, masterKey)).rejects.toThrow(/Authentication failed|tampered/i);
    });

    it('detects tampered v2 tag', async () => {
      const masterKey = await getOrCreateMasterKey();
      const encrypted = await encryptV2('secret data', masterKey);
      encrypted.tag = '0'.repeat(64);
      await expect(decryptV2(encrypted, masterKey)).rejects.toThrow(/Authentication failed|tampered/i);
    });
  });
});
