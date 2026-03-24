/**
 * AuthService — Unit Tests
 *
 * Coverage: password lifecycle, key hierarchy, biometric bridge,
 * changePassword, lock/unlock, master key consistency.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

(globalThis as any).__DEV__ = false;

// ==========================================================================
// SETUP — clear SecureStore between tests for isolation
// ==========================================================================

let authService: typeof import('../src/security/AuthService').authService;

beforeEach(async () => {
  // Reset SecureStore state between tests
  const secureStore = await import('expo-secure-store');
  (secureStore as any).clearAll();

  // Re-import AuthService fresh — need to reset the singleton's in-memory state.
  // Since the singleton is module-level, we use lock() + re-init to reset.
  // But to fully reset, we dynamically re-import with module cache busting.
  vi.resetModules();
  const mod = await import('../src/security/AuthService');
  authService = mod.authService;
});

// ==========================================================================
// INITIALIZATION
// ==========================================================================

describe('AuthService — Initialization', () => {
  it('returns NO_PASSWORD when no password is configured', async () => {
    const state = await authService.initialize();
    expect(state).toBe('NO_PASSWORD');
  });

  it('returns LOCKED when password was previously set', async () => {
    // Set up a password first (stores flag in SecureStore)
    await authService.setPassword('secure123');
    authService.lock();

    // Re-initialize — SecureStore retains the PASSWORD_CONFIGURED flag
    const state = await authService.initialize();
    expect(state).toBe('LOCKED');
  });
});

// ==========================================================================
// PASSWORD SETUP
// ==========================================================================

describe('AuthService — Password Setup', () => {
  it('rejects passwords shorter than 6 characters', async () => {
    await expect(authService.setPassword('abc')).rejects.toThrow('at least 6');
  });

  it('sets password and transitions to UNLOCKED', async () => {
    await authService.setPassword('mypassword');
    expect(authService.getLockState()).toBe('UNLOCKED');
  });

  it('produces a master key after setup', async () => {
    await authService.setPassword('testpass');
    const key = authService.getMasterKey();
    expect(key).toBeTruthy();
    expect(typeof key).toBe('string');
    expect(key!.length).toBeGreaterThan(0);
  });
});

// ==========================================================================
// PASSWORD UNLOCK
// ==========================================================================

describe('AuthService — Password Unlock', () => {
  it('unlocks with correct password', async () => {
    await authService.setPassword('correcthorse');
    const mekAfterSetup = authService.getMasterKey();
    authService.lock();
    expect(authService.getLockState()).toBe('LOCKED');

    const result = await authService.unlockWithPassword('correcthorse');
    expect(result).toBe(true);
    expect(authService.getLockState()).toBe('UNLOCKED');
    // Master key must be identical
    expect(authService.getMasterKey()).toBe(mekAfterSetup);
  });

  it('rejects wrong password', async () => {
    await authService.setPassword('correctpass');
    authService.lock();

    const result = await authService.unlockWithPassword('wrongpass');
    expect(result).toBe(false);
    expect(authService.getLockState()).toBe('LOCKED');
    expect(authService.getMasterKey()).toBeNull();
  });

  it('throws when no password is configured', async () => {
    await expect(authService.unlockWithPassword('any')).rejects.toThrow('not configured');
  });
});

// ==========================================================================
// KEY CONSISTENCY
// ==========================================================================

describe('AuthService — Key Consistency', () => {
  it('master key survives lock/unlock cycle', async () => {
    await authService.setPassword('keytest');
    const key1 = authService.getMasterKey()!;

    authService.lock();
    expect(authService.getMasterKey()).toBeNull();

    await authService.unlockWithPassword('keytest');
    const key2 = authService.getMasterKey()!;

    expect(key1).toBe(key2);
  });

  it('master key survives multiple lock/unlock cycles', async () => {
    await authService.setPassword('multitest');
    const originalKey = authService.getMasterKey()!;

    for (let i = 0; i < 3; i++) {
      authService.lock();
      await authService.unlockWithPassword('multitest');
      expect(authService.getMasterKey()).toBe(originalKey);
    }
  });

  it('requireMasterKey throws when locked', async () => {
    await authService.setPassword('locktest');
    authService.lock();
    expect(() => authService.requireMasterKey()).toThrow('locked');
  });

  it('requireMasterKey returns key when unlocked', async () => {
    await authService.setPassword('unlocktest');
    const key = authService.requireMasterKey();
    expect(key).toBeTruthy();
    expect(key.length).toBeGreaterThan(0);
  });
});

// ==========================================================================
// LOCK
// ==========================================================================

describe('AuthService — Lock', () => {
  it('clears in-memory keys on lock', async () => {
    await authService.setPassword('cleartest');
    expect(authService.getMasterKey()).toBeTruthy();

    authService.lock();
    expect(authService.getMasterKey()).toBeNull();
    expect(authService.getLockState()).toBe('LOCKED');
  });
});

// ==========================================================================
// BIOMETRIC BRIDGE
// ==========================================================================

describe('AuthService — Biometric Bridge', () => {
  it('throws if enabling biometric without unlock', async () => {
    await expect(authService.enableBiometricUnlock()).rejects.toThrow('unlock with password first');
  });

  it('enables biometric and unlocks via biometric key', async () => {
    await authService.setPassword('biopass');
    const mek = authService.getMasterKey()!;

    await authService.enableBiometricUnlock();
    const hasBio = await authService.hasBiometricKey();
    expect(hasBio).toBe(true);

    authService.lock();

    const result = await authService.unlockWithBiometric();
    expect(result).toBe(true);
    expect(authService.getLockState()).toBe('UNLOCKED');
    expect(authService.getMasterKey()).toBe(mek);
  });

  it('biometric unlock fails without stored key', async () => {
    const result = await authService.unlockWithBiometric();
    expect(result).toBe(false);
  });
});

// ==========================================================================
// CHANGE PASSWORD
// ==========================================================================

describe('AuthService — Change Password', () => {
  it('throws if not unlocked', async () => {
    await expect(authService.changePassword('old', 'newpass123')).rejects.toThrow('unlocked');
  });

  it('rejects wrong current password', async () => {
    await authService.setPassword('original');
    const result = await authService.changePassword('wrong', 'newpass123');
    expect(result).toBe(false);
  });

  it('rejects short new password', async () => {
    await authService.setPassword('original');
    await expect(authService.changePassword('original', 'ab')).rejects.toThrow('at least 6');
  });

  it('changes password and preserves master key', async () => {
    await authService.setPassword('oldpass');
    const mek = authService.getMasterKey()!;

    const changed = await authService.changePassword('oldpass', 'newpass');
    expect(changed).toBe(true);

    // Master key must be the same
    expect(authService.getMasterKey()).toBe(mek);

    // Old password no longer works
    authService.lock();
    const oldResult = await authService.unlockWithPassword('oldpass');
    expect(oldResult).toBe(false);

    // New password works
    const newResult = await authService.unlockWithPassword('newpass');
    expect(newResult).toBe(true);
    expect(authService.getMasterKey()).toBe(mek);
  });

  it('updates biometric key after password change', async () => {
    await authService.setPassword('bioold');
    await authService.enableBiometricUnlock();

    await authService.changePassword('bioold', 'bionew');
    authService.lock();

    // Biometric should still work (key was updated)
    const result = await authService.unlockWithBiometric();
    expect(result).toBe(true);
  });
});

// ==========================================================================
// STATUS
// ==========================================================================

describe('AuthService — Status', () => {
  it('reports correct status before setup', async () => {
    const status = authService.getStatus();
    // Default lockState before initialize is LOCKED
    expect(status.lockState).toBeDefined();
  });

  it('reports UNLOCKED status after setup', async () => {
    await authService.setPassword('statustest');
    const status = authService.getStatus();
    expect(status.lockState).toBe('UNLOCKED');
    expect(status.hasPassword).toBe(true);
  });
});
