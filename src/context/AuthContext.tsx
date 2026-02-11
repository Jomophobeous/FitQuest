import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as Crypto from 'expo-crypto';
import { BiometricAuthService, type BiometricCapability, type AuthResult } from '../security/BiometricAuth';
import {
  migrateToSecureStorage,
  getAuthToken,
  getUserProfile,
  setAuthCredentials,
  clearAuthCredentials,
} from '../security/StorageMigration';
import { encryptedDB } from '../security/EncryptedDatabase';

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
  /** Biometric hardware info (null until initialize()) */
  biometricCapability: BiometricCapability | null;
  /** Whether biometric auth is enabled by user preference */
  biometricEnabled: boolean;
  /** Sign in with email/password (creates local account) */
  signIn: (email: string, password: string) => Promise<void>;
  /** Register new local account */
  signUp: (email: string, password: string, name: string) => Promise<void>;
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
  /** Enable/disable biometric preference */
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  /** Check if current session is still valid (30-min expiry) */
  isSessionValid: () => Promise<boolean>;
  /** Refresh session expiry on user activity */
  touchSession: () => Promise<void>;
}

// ============================================
// CONTEXT
// ============================================

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: false,
  isSignedIn: false,
  biometricCapability: null,
  biometricEnabled: false,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  restoreToken: async () => {},
  authenticateWithBiometrics: async () => ({ success: false, method: 'BIOMETRIC' }),
  setupPasscode: async () => {},
  verifyPasscode: async () => ({ success: false, method: 'PASSCODE' }),
  hasPasscode: async () => false,
  setBiometricEnabled: async () => {},
  isSessionValid: async () => false,
  touchSession: async () => {},
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
  const [biometricCapability, setBiometricCapability] = useState<BiometricCapability | null>(null);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);

  const bioAuth = BiometricAuthService.getInstance();

  // ============================================
  // INITIALIZATION
  // ============================================

  const restoreToken = useCallback(async () => {
    try {
      setIsLoading(true);

      // Step 1: Migrate sensitive data from AsyncStorage → SecureStore (idempotent)
      await migrateToSecureStorage();

      // Step 2: Initialize biometric capabilities
      const capability = await bioAuth.initialize();
      setBiometricCapability(capability);

      // Step 3: Check biometric preference
      const bioEnabled = await bioAuth.isBiometricEnabled();
      setBiometricEnabledState(bioEnabled);

      // Step 4: Initialize encrypted database layer
      await encryptedDB.initialize();

      // Step 5: Check for valid session
      const hasSession = await bioAuth.isSessionValid();

      // Step 6: Restore user data from SecureStore
      const [storedToken, storedUser] = await Promise.all([
        getAuthToken(),
        getUserProfile(),
      ]);

      if (storedToken && storedUser && hasSession) {
        setToken(storedToken);
        setUser(storedUser as User);
      } else if (storedToken && storedUser) {
        // Credentials exist but session expired — user needs to re-authenticate
        // Keep user data loaded but don't set token (isSignedIn = false)
        setUser(storedUser as User);
      }
    } catch (err) {
      console.log('[FitQuest Auth] Failed to restore session:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreToken();
  }, [restoreToken]);

  // ============================================
  // EMAIL/PASSWORD AUTH (local accounts)
  // ============================================

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);

      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      // Generate cryptographically secure token
      const tokenBytes = await Crypto.getRandomBytesAsync(32);
      const newToken = Array.from(tokenBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const newUser: User = {
        id: 'user_local_001', // Consistent with existing database user ID
        email,
        name: email.split('@')[0],
      };

      // Store in SecureStore (NOT AsyncStorage)
      await setAuthCredentials(newToken, newUser);

      // Create biometric session
      const bioEnabled = await bioAuth.isBiometricEnabled();
      if (bioEnabled && biometricCapability?.isAvailable) {
        // Authenticate with biometrics to create session
        const result = await bioAuth.authenticate('Verify identity to sign in');
        if (!result.success) {
          // Still allow sign in, just without biometric session
          console.log('[FitQuest Auth] Biometric verification skipped during sign-in');
        }
      }

      setToken(newToken);
      setUser(newUser);
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

      // Generate cryptographically secure token
      const tokenBytes = await Crypto.getRandomBytesAsync(32);
      const newToken = Array.from(tokenBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const newUser: User = {
        id: 'user_local_001',
        email,
        name,
      };

      // Store in SecureStore
      await setAuthCredentials(newToken, newUser);

      setToken(newToken);
      setUser(newUser);
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
      // Clear SecureStore credentials
      await clearAuthCredentials();
      setToken(null);
      setUser(null);
    } catch (err) {
      console.log('[FitQuest Auth] Failed to sign out:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // BIOMETRIC AUTH
  // ============================================

  const authenticateWithBiometrics = async (prompt?: string): Promise<AuthResult> => {
    return bioAuth.authenticate(prompt || 'Unlock FitQuest');
  };

  const setupPasscode = async (passcode: string): Promise<void> => {
    await bioAuth.setPasscode(passcode);
  };

  const verifyPasscode = async (passcode: string): Promise<AuthResult> => {
    return bioAuth.verifyPasscode(passcode);
  };

  const hasPasscode = async (): Promise<boolean> => {
    return bioAuth.hasPasscode();
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
  // CONTEXT VALUE
  // ============================================

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isSignedIn: !!token,
    biometricCapability,
    biometricEnabled,
    signIn,
    signUp,
    signOut,
    restoreToken,
    authenticateWithBiometrics,
    setupPasscode,
    verifyPasscode,
    hasPasscode,
    setBiometricEnabled,
    isSessionValid,
    touchSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
