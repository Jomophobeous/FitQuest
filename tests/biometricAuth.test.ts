import { describe, expect, it, vi, beforeEach } from 'vitest';

// ============================================
// MOCK NATIVE MODULES
// ============================================

const mockSecureStore: Record<string, string> = {};

vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: vi.fn(() => Promise.resolve(true)),
  isEnrolledAsync: vi.fn(() => Promise.resolve(true)),
  getEnrolledLevelAsync: vi.fn(() => Promise.resolve(2)), // BIOMETRIC_STRONG
  supportedAuthenticationTypesAsync: vi.fn(() => Promise.resolve([1])), // FINGERPRINT
  authenticateAsync: vi.fn(() => Promise.resolve({ success: true })),
  AuthenticationType: { FACIAL_RECOGNITION: 2, FINGERPRINT: 1, IRIS: 3 },
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_STRONG: 2 },
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn((key: string) => Promise.resolve(mockSecureStore[key] ?? null)),
  setItemAsync: vi.fn((key: string, value: string) => {
    mockSecureStore[key] = value;
    return Promise.resolve();
  }),
  deleteItemAsync: vi.fn((key: string) => {
    delete mockSecureStore[key];
    return Promise.resolve();
  }),
}));

vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: vi.fn((n: number) =>
    Promise.resolve(new Uint8Array(n).fill(42))
  ),
  digestStringAsync: vi.fn((_algo: unknown, data: string) =>
    Promise.resolve(`sha256_${data.slice(0, 20)}`)
  ),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

import { BiometricAuthService } from '../src/security/BiometricAuth';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

// ============================================
// HELPERS
// ============================================

function freshInstance(): BiometricAuthService {
  // @ts-expect-error — reset singleton for test isolation
  BiometricAuthService.instance = null;
  return BiometricAuthService.getInstance();
}

beforeEach(() => {
  vi.clearAllMocks();
  // Clear mock secure store
  for (const key of Object.keys(mockSecureStore)) {
    delete mockSecureStore[key];
  }
});

// ============================================
// SINGLETON
// ============================================

describe('BiometricAuthService singleton', () => {
  it('returns same instance on repeated calls', () => {
    const a = BiometricAuthService.getInstance();
    const b = BiometricAuthService.getInstance();
    expect(a).toBe(b);
  });
});

// ============================================
// INITIALIZE
// ============================================

describe('BiometricAuthService.initialize', () => {
  it('detects fingerprint hardware', async () => {
    const bio = freshInstance();
    const cap = await bio.initialize();
    expect(cap.isAvailable).toBe(true);
    expect(cap.biometricType).toBe('FINGERPRINT');
    expect(cap.isEnrolled).toBe(true);
  });

  it('detects Face ID when available', async () => {
    vi.mocked(LocalAuthentication.supportedAuthenticationTypesAsync).mockResolvedValueOnce([2]); // FACIAL_RECOGNITION
    const bio = freshInstance();
    const cap = await bio.initialize();
    expect(cap.biometricType).toBe('FACE_ID');
  });

  it('reports NONE when no biometric enrolled', async () => {
    vi.mocked(LocalAuthentication.isEnrolledAsync).mockResolvedValueOnce(false);
    vi.mocked(LocalAuthentication.hasHardwareAsync).mockResolvedValueOnce(false);
    vi.mocked(LocalAuthentication.supportedAuthenticationTypesAsync).mockResolvedValueOnce([]);
    const bio = freshInstance();
    const cap = await bio.initialize();
    expect(cap.biometricType).toBe('NONE');
    expect(cap.isAvailable).toBe(false);
  });

  it('caches capability on second call', async () => {
    const bio = freshInstance();
    await bio.initialize();
    await bio.initialize();
    // hasHardwareAsync only called once (cached)
    expect(LocalAuthentication.hasHardwareAsync).toHaveBeenCalledTimes(1);
  });
});

// ============================================
// AUTHENTICATION
// ============================================

describe('BiometricAuthService.authenticate', () => {
  it('returns success + session token on biometric match', async () => {
    const bio = freshInstance();
    await bio.initialize();
    const result = await bio.authenticate();
    expect(result.success).toBe(true);
    expect(result.method).toBe('BIOMETRIC');
    expect(result.sessionToken).toBeDefined();
    expect(typeof result.sessionToken).toBe('string');
  });

  it('records failed attempt on biometric rejection', async () => {
    vi.mocked(LocalAuthentication.authenticateAsync).mockResolvedValueOnce({
      success: false,
      error: 'user_cancel',
      warning: '',
    });
    const bio = freshInstance();
    await bio.initialize();
    const result = await bio.authenticate();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    // Failed attempts counter should be set
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'fitquest_failed_attempts',
      '1'
    );
  });

  it('returns error when biometrics unavailable', async () => {
    vi.mocked(LocalAuthentication.hasHardwareAsync).mockResolvedValueOnce(false);
    vi.mocked(LocalAuthentication.isEnrolledAsync).mockResolvedValueOnce(false);
    vi.mocked(LocalAuthentication.supportedAuthenticationTypesAsync).mockResolvedValueOnce([]);
    const bio = freshInstance();
    await bio.initialize();
    const result = await bio.authenticate();
    expect(result.success).toBe(false);
    expect(result.error).toContain('not available');
  });
});

// ============================================
// SESSION MANAGEMENT
// ============================================

describe('BiometricAuthService session', () => {
  it('isSessionValid returns true after successful auth', async () => {
    const bio = freshInstance();
    await bio.initialize();
    await bio.authenticate();
    const valid = await bio.isSessionValid();
    expect(valid).toBe(true);
  });

  it('endSession clears current session', async () => {
    const bio = freshInstance();
    await bio.initialize();
    await bio.authenticate();
    expect(bio.getSession()).not.toBeNull();
    await bio.endSession();
    expect(bio.getSession()).toBeNull();
  });

  it('touchSession extends expiry', async () => {
    const bio = freshInstance();
    await bio.initialize();
    await bio.authenticate();
    const originalExpiry = bio.getSession()!.expiresAt;
    // Simulate time passing
    await new Promise((r) => setTimeout(r, 10));
    await bio.touchSession();
    expect(bio.getSession()!.expiresAt).toBeGreaterThanOrEqual(originalExpiry);
  });

  it('startCredentialSession creates session without biometric prompt', async () => {
    const bio = freshInstance();
    await bio.initialize();
    const session = await bio.startCredentialSession();
    expect(session.token).toBeDefined();
    expect(session.authMethod).toBe('PASSCODE');
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });
});

// ============================================
// PASSCODE
// ============================================

describe('BiometricAuthService passcode', () => {
  it('hasPasscode returns false when none set', async () => {
    const bio = freshInstance();
    expect(await bio.hasPasscode()).toBe(false);
  });

  it('rejects passcode shorter than 4 characters', async () => {
    const bio = freshInstance();
    await expect(bio.setPasscode('12')).rejects.toThrow('at least 4');
  });

  it('setPasscode stores hash + salt', async () => {
    const bio = freshInstance();
    await bio.setPasscode('123456');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'fitquest_passcode_hash',
      expect.any(String)
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'fitquest_passcode_salt',
      expect.any(String)
    );
  });

  it('verifyPasscode fails when no passcode set', async () => {
    const bio = freshInstance();
    await bio.initialize();
    const result = await bio.verifyPasscode('1234');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No passcode set');
  });
});

// ============================================
// BIOMETRIC PREFERENCE
// ============================================

describe('BiometricAuthService preferences', () => {
  it('isBiometricEnabled defaults to false', async () => {
    const bio = freshInstance();
    expect(await bio.isBiometricEnabled()).toBe(false);
  });

  it('setBiometricEnabled persists preference', async () => {
    const bio = freshInstance();
    await bio.setBiometricEnabled(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'fitquest_biometric_enabled',
      'true'
    );
  });
});

// ============================================
// LOCKOUT
// ============================================

describe('BiometricAuthService lockout', () => {
  it('allows authentication when not locked out', async () => {
    const bio = freshInstance();
    await bio.initialize();
    const result = await bio.authenticate();
    expect(result.success).toBe(true);
  });

  it('blocks authentication during active lockout', async () => {
    // Simulate active lockout
    mockSecureStore['fitquest_lockout_until'] = (Date.now() + 60_000).toString();
    const bio = freshInstance();
    await bio.initialize();
    const result = await bio.authenticate();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Too many attempts');
  });

  it('allows authentication after lockout expires', async () => {
    // Expired lockout
    mockSecureStore['fitquest_lockout_until'] = (Date.now() - 1000).toString();
    const bio = freshInstance();
    await bio.initialize();
    const result = await bio.authenticate();
    expect(result.success).toBe(true);
  });
});
