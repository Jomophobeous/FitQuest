import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { BiometricAuthService, type BiometricCapability, type AuthResult } from '../security/BiometricAuth';
import {
  migrateToSecureStorage,
  getAuthToken,
  getRefreshToken,
  getUserProfile,
  setAuthCredentials,
  clearAuthCredentials,
} from '../security/StorageMigration';
import { assertValidSession } from '../security/SafeSecureStore';
import {
  loginWithAppleIdToken,
  loginWithEmail,
  loginWithGoogleIdToken,
  logoutEverywhere,
  refreshWithStoredToken,
  registerCurrentDeviceMigration,
  registerWithEmail,
} from '../services/authApi';
import { getApiBaseUrl } from '../services/apiBaseUrl';
import { authEventBus, type AuthFailureReason } from '../services/security/authEventBus';

// ============================================
// TYPES
// ============================================

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isSignedIn: boolean;
  /** True when user has authenticated via biometric, passcode, OR server token */
  isAuthenticated: boolean;
  /** Whether a backend server is configured (EXPO_PUBLIC_API_BASE_URL is set) */
  isServerConfigured: boolean;
  /** Biometric hardware info (null until initialize()) */
  biometricCapability: BiometricCapability | null;
  /** Whether biometric auth is enabled by user preference */
  biometricEnabled: boolean;
  /** Sign in with email/password (creates local account) */
  signIn: (email: string, password: string) => Promise<void>;
  /** Register new local account */
  signUp: (email: string, password: string, name: string) => Promise<void>;
  /** Sign in with Google provider ID token */
  signInWithGoogleToken: (idToken: string) => Promise<void>;
  /** Sign in with Apple provider ID token */
  signInWithAppleToken: (idToken: string) => Promise<void>;
  /** Sign out (clears session + SecureStore) */
  signOut: () => Promise<void>;
  /** Restore session from SecureStore on app launch */
  restoreToken: () => Promise<void>;
  /** Authenticate via biometrics (Face ID / fingerprint) */
  authenticateWithBiometrics: (prompt?: string) => Promise<AuthResult>;
  /** Set up passcode for fallback auth */
  setupPasscode: (passcode: string) => Promise<void>;
  /** Verify passcode */
  verifyPasscode: (passcode: string) => Promise<AuthResult>;
  /** Check if user has a passcode set */
  hasPasscode: () => Promise<boolean>;
  /** Mark user as locally authenticated (called after AuthGate unlock) */
  markAsLocallyAuthenticated: () => void;
  /** Enable/disable biometric preference */
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  /** Check if current session is still valid (30-min expiry) */
  isSessionValid: () => Promise<boolean>;
  /** Refresh session expiry on user activity */
  touchSession: () => Promise<void>;

  /** Resume server session using stored refresh token (requires valid biometric/passcode session) */
  resumeSession: () => Promise<void>;
}

// ============================================
// CONTEXT
// ============================================

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: false,
  isSignedIn: false,
  isAuthenticated: false,
  isServerConfigured: false,
  biometricCapability: null,
  biometricEnabled: false,
  signIn: async () => {},
  signUp: async () => {},
  signInWithGoogleToken: async () => {},
  signInWithAppleToken: async () => {},
  signOut: async () => {},
  restoreToken: async () => {},
  authenticateWithBiometrics: async () => ({ success: false, method: 'BIOMETRIC' }),
  setupPasscode: async () => {},
  verifyPasscode: async () => ({ success: false, method: 'PASSCODE' }),
  hasPasscode: async () => false,
  markAsLocallyAuthenticated: () => {},
  setBiometricEnabled: async () => {},
  isSessionValid: async () => false,
  touchSession: async () => {},
  resumeSession: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// ============================================
// PROVIDER
// ============================================

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocallyAuthenticated, setIsLocallyAuthenticated] = useState(false);
  const [biometricCapability, setBiometricCapability] = useState<BiometricCapability | null>(null);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);

  const isServerConfigured = !!getApiBaseUrl();

  const bioAuth = BiometricAuthService.getInstance();

  // ============================================
  // INITIALIZATION
  // ============================================

  const restoreToken = useCallback(async () => {
    try {
      setIsLoading(true);

      // Step 1: Ensure SecureStore-backed credentials are initialized
      await migrateToSecureStorage();

      // Step 2: Initialize biometric capabilities
      const capability = await bioAuth.initialize();
      setBiometricCapability(capability);

      // Step 3: Check biometric preference
      const bioEnabled = await bioAuth.isBiometricEnabled();
      setBiometricEnabledState(bioEnabled);

      // Step 4: Check for valid session
      const hasSession = await bioAuth.isSessionValid();

      // Step 5: Restore user data + attempt to ensure access token (only if local session is valid)
      const [storedToken, storedUser, storedRefresh] = await Promise.all([
        getAuthToken(),
        getUserProfile(),
        getRefreshToken(),
      ]);

      if (storedUser) {
        setUser(storedUser as User);
      }

      if (hasSession && storedRefresh) {
        // Best-effort refresh to ensure the access token is usable.
        try {
          const session = await refreshWithStoredToken();
          setToken(session.accessToken);
          setUser(session.user as User);
          try {
            await registerCurrentDeviceMigration();
          } catch {
            // Non-blocking: auth should continue even if migration registration fails.
          }
        } catch {
          if (storedToken && storedUser) {
            setToken(storedToken);
          }
        }
      }
    } catch (err: any) {
      if (__DEV__) console.warn('[FitQuest Auth] Failed to restore session:', err);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bioAuth is a singleton; mount-only restore
  }, []);

  useEffect(() => {
    restoreToken();
  }, [restoreToken]);

  // ============================================
  // APP LOCK ON BACKGROUND
  // ============================================

  const backgroundTimestampRef = useRef<number | null>(null);
  const APP_LOCK_THRESHOLD_MS = 30_000; // 30 seconds

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundTimestampRef.current = Date.now();
      } else if (nextState === 'active' && backgroundTimestampRef.current) {
        const elapsed = Date.now() - backgroundTimestampRef.current;
        backgroundTimestampRef.current = null;
        if (elapsed > APP_LOCK_THRESHOLD_MS && isLocallyAuthenticated) {
          setIsLocallyAuthenticated(false);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isLocallyAuthenticated]);

  // ============================================
  // EMAIL/PASSWORD AUTH (local accounts)
  // ============================================

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);

      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      const session = await loginWithEmail({ email, password });
      assertValidSession(session, 'signIn');
      await setAuthCredentials(session.accessToken, session.user, session.refreshToken);
      await bioAuth.startCredentialSession();
      setToken(session.accessToken);
      setUser(session.user as User);
      try {
        await registerCurrentDeviceMigration();
      } catch {
        // Non-blocking
      }
    } catch (err: any) {
      throw new Error(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      setIsLoading(true);

      if (!email || !password || !name) {
        throw new Error('Email, password, and name are required');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      const session = await registerWithEmail({ email, password, name });
      // Validate session fields before writing to SecureStore — server may return
      // malformed JSON during cold start or error states.
      assertValidSession(session, 'signUp');
      await setAuthCredentials(session.accessToken, session.user, session.refreshToken);
      await bioAuth.startCredentialSession();
      setToken(session.accessToken);
      setUser(session.user as User);
      try {
        await registerCurrentDeviceMigration();
      } catch {
        // Non-blocking
      }
    } catch (err: any) {
      throw new Error(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      // End biometric session
      await bioAuth.endSession();

      // Revoke server refresh token when possible.
      // Falls back to local clear if network/server is unavailable.
      if (isServerConfigured) {
        try {
          await logoutEverywhere();
        } catch {
          /* offline — skip server logout */
        }
      }

      // Defensive clear in case logoutEverywhere throws before cleanup.
      await clearAuthCredentials();
      setToken(null);
      setUser(null);
      setIsLocallyAuthenticated(false);
    } catch (err: any) {
      if (__DEV__) console.warn('[FitQuest Auth] Failed to sign out:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogleToken = async (idToken: string) => {
    try {
      setIsLoading(true);

      const session = await loginWithGoogleIdToken({ idToken });
      assertValidSession(session, 'signInWithGoogleToken');
      await setAuthCredentials(session.accessToken, session.user, session.refreshToken);
      await bioAuth.startCredentialSession();
      setToken(session.accessToken);
      setUser(session.user as User);
      try {
        await registerCurrentDeviceMigration();
      } catch {
        // Non-blocking
      }
    } catch (err: any) {
      throw new Error(err.message || 'Google sign-in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithAppleToken = async (idToken: string) => {
    try {
      setIsLoading(true);

      const session = await loginWithAppleIdToken({ idToken });
      assertValidSession(session, 'signInWithAppleToken');
      await setAuthCredentials(session.accessToken, session.user, session.refreshToken);
      await bioAuth.startCredentialSession();
      setToken(session.accessToken);
      setUser(session.user as User);
      try {
        await registerCurrentDeviceMigration();
      } catch {
        // Non-blocking
      }
    } catch (err: any) {
      throw new Error(err.message || 'Apple sign-in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const resumeSession = async () => {
    setIsLoading(true);
    try {
      const hasSession = await bioAuth.isSessionValid();
      if (!hasSession) throw new Error('Session expired');
      const session = await refreshWithStoredToken();
      setToken(session.accessToken);
      setUser(session.user as User);
      try {
        await registerCurrentDeviceMigration();
      } catch {
        // Non-blocking
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // BIOMETRIC AUTH
  // ============================================

  const authenticateWithBiometrics = async (prompt?: string): Promise<AuthResult> => {
    const result = await bioAuth.authenticate(prompt || 'Unlock FitQuest');
    if (result.success) setIsLocallyAuthenticated(true);
    return result;
  };

  const setupPasscode = async (passcode: string): Promise<void> => {
    await bioAuth.setPasscode(passcode);
  };

  const verifyPasscode = async (passcode: string): Promise<AuthResult> => {
    const result = await bioAuth.verifyPasscode(passcode);
    if (result.success) setIsLocallyAuthenticated(true);
    return result;
  };

  const hasPasscode = async (): Promise<boolean> => {
    return bioAuth.hasPasscode();
  };

  const markAsLocallyAuthenticated = (): void => {
    setIsLocallyAuthenticated(true);
  };

  const setBiometricEnabled = async (enabled: boolean): Promise<void> => {
    await bioAuth.setBiometricEnabled(enabled);
    setBiometricEnabledState(enabled);
  };

  const isSessionValid = async (): Promise<boolean> => {
    return bioAuth.isSessionValid();
  };

  const touchSession = async (): Promise<void> => {
    await bioAuth.touchSession();
  };

  // ============================================
  // AUTH EVENT BUS — FORCED LOGOUT ON FAILURE
  // ============================================

  useEffect(() => {
    const unsubscribe = authEventBus.subscribe(async (reason: AuthFailureReason) => {
      if (__DEV__) console.warn(`[AuthProvider] Forced logout triggered: ${reason}`);
      // Clear all auth state — no silent failures
      try {
        await bioAuth.endSession();
      } catch {
        /* best effort */
      }
      await clearAuthCredentials();
      setToken(null);
      setUser(null);
      setIsLocallyAuthenticated(false);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, []);

  // ============================================
  // CONTEXT VALUE
  // ============================================

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      isLoading,
      isSignedIn: !!token,
      isAuthenticated: !!token || isLocallyAuthenticated,
      isServerConfigured,
      biometricCapability,
      biometricEnabled,
      signIn,
      signUp,
      signInWithGoogleToken,
      signInWithAppleToken,
      signOut,
      restoreToken,
      authenticateWithBiometrics,
      setupPasscode,
      verifyPasscode,
      hasPasscode,
      markAsLocallyAuthenticated,
      setBiometricEnabled,
      isSessionValid,
      touchSession,
      resumeSession,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks are stable useCallback refs; listed deps cover state changes
    [user, token, isLoading, isLocallyAuthenticated, biometricCapability, biometricEnabled],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};
