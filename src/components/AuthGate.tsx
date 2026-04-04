/**
 * AuthGate — Global authentication barrier.
 *
 * Blocks ALL app content (Database, Sensors, AI, UI) until the user
 * authenticates via biometric or password.
 *
 * States:
 *   INITIALIZING → checking if password is set up
 *   SETUP        → first-time password setup screen
 *   LOCKED       → authentication required (biometric prompt or password input)
 *   UNLOCKED     → children rendered normally
 *
 * Placement: Wraps DatabaseProvider in _layout.tsx.
 * DB must NOT initialize before UNLOCKED state.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { authService } from '../security/AuthService';
import { BiometricAuthService } from '../security/BiometricAuth';
import { darkTheme as theme, typography, spacing } from '../design/theme-system';

// ============================================
// CONSTANTS
// ============================================

const AUTO_LOCK_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes background → auto-lock
const MAX_FAILED_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 2000; // 2s, 4s, 8s, 16s, 32s…
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes after MAX_FAILED_ATTEMPTS

// ============================================
// COMPONENT
// ============================================

type GateState = 'INITIALIZING' | 'SETUP' | 'LOCKED' | 'UNLOCKED';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [gateState, setGateState] = useState<GateState>('INITIALIZING');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(0); // Unix ms timestamp
  const backgroundTimestampRef = useRef<number | null>(null);
  const initRef = useRef(false);

  // ============================================
  // INITIALIZATION
  // ============================================

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      const state = await authService.initialize();
      if (state === 'NO_PASSWORD') {
        setGateState('SETUP');
      } else {
        setGateState('LOCKED');
        // Attempt biometric unlock automatically
        attemptBiometricUnlock();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only init; attemptBiometricUnlock defined below
  }, []);

  // ============================================
  // AUTO-LOCK ON BACKGROUND (ORDER 4)
  // ============================================

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundTimestampRef.current = Date.now();
      } else if (nextState === 'active' && backgroundTimestampRef.current) {
        const elapsed = Date.now() - backgroundTimestampRef.current;
        backgroundTimestampRef.current = null;
        if (elapsed > AUTO_LOCK_TIMEOUT_MS && gateState === 'UNLOCKED') {
          authService.lock();
          setGateState('LOCKED');
          setPassword('');
          setError('');
          // Attempt biometric re-auth
          attemptBiometricUnlock();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- attemptBiometricUnlock is a stable useCallback ref
  }, [gateState]);

  // ============================================
  // BIOMETRIC UNLOCK
  // ============================================

  const attemptBiometricUnlock = useCallback(async () => {
    const bioAuth = BiometricAuthService.getInstance();
    const capability = await bioAuth.initialize();
    const hasBioKey = await authService.hasBiometricKey();

    if (!capability.isAvailable || !hasBioKey) return;

    const result = await bioAuth.authenticate('Unlock FitQuest');
    if (result.success) {
      const unlocked = await authService.unlockWithBiometric();
      if (unlocked) {
        setFailedAttempts(0);
        setLockoutUntil(0);
        setGateState('UNLOCKED');
        setError('');
        return;
      }
    }
    // Biometric failed — user must enter password
  }, []);

  // ============================================
  // PASSWORD SETUP
  // ============================================

  const handleSetupPassword = useCallback(async () => {
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setIsProcessing(true);
    try {
      await authService.setPassword(password);

      // Offer biometric enrollment
      const bioAuth = BiometricAuthService.getInstance();
      const capability = await bioAuth.initialize();
      if (capability.isAvailable) {
        await authService.enableBiometricUnlock();
      }

      setGateState('UNLOCKED');
      setPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      setError(e.message || 'Failed to set password');
    } finally {
      setIsProcessing(false);
    }
  }, [password, confirmPassword]);

  // ============================================
  // PASSWORD UNLOCK
  // ============================================

  const handlePasswordUnlock = useCallback(async () => {
    setError('');
    if (!password) {
      setError('Enter your password');
      return;
    }

    // Brute-force gate: check lockout
    const now = Date.now();
    if (lockoutUntil > now) {
      const remainSec = Math.ceil((lockoutUntil - now) / 1000);
      setError(`Too many attempts. Try again in ${remainSec}s`);
      return;
    }

    // Exponential backoff between attempts
    if (failedAttempts > 0) {
      const backoffMs = BASE_BACKOFF_MS * Math.pow(2, failedAttempts - 1);
      // Enforce a brief delay before processing (non-blocking UX: disable button)
      setIsProcessing(true);
      await new Promise((r) => setTimeout(r, Math.min(backoffMs, 30_000))); // debounce
    }

    setIsProcessing(true);
    try {
      const success = await authService.unlockWithPassword(password);
      if (success) {
        setFailedAttempts(0);
        setLockoutUntil(0);
        setGateState('UNLOCKED');
        setPassword('');
      } else {
        const attempts = failedAttempts + 1;
        setFailedAttempts(attempts);
        if (attempts >= MAX_FAILED_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_DURATION_MS;
          setLockoutUntil(until);
          setError(`Locked for 5 minutes after ${MAX_FAILED_ATTEMPTS} failed attempts`);
        } else {
          setError(`Wrong password (${attempts}/${MAX_FAILED_ATTEMPTS})`);
        }
      }
    } catch (e: any) {
      setError(e.message || 'Unlock failed');
    } finally {
      setIsProcessing(false);
    }
  }, [password, failedAttempts, lockoutUntil]);

  // ============================================
  // RENDER
  // ============================================

  if (gateState === 'INITIALIZING') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (gateState === 'UNLOCKED') {
    return <>{children}</>;
  }

  if (gateState === 'SETUP') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Set Up Password</Text>
        <Text style={styles.subtitle}>
          Protect your fitness data with a password. This encrypts all your health information.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Password (min 6 characters)"
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          autoFocus
          editable={!isProcessing}
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          editable={!isProcessing}
          onSubmitEditing={handleSetupPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, isProcessing && styles.buttonDisabled]}
          onPress={handleSetupPassword}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color={theme.colors.onAccent} />
          ) : (
            <Text style={styles.buttonText}>Set Password</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // LOCKED state
  return (
    <View style={styles.container}>
      <Text style={styles.title}>FitQuest Locked</Text>
      <Text style={styles.subtitle}>Enter your password to unlock</Text>

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={theme.colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        autoFocus
        editable={!isProcessing}
        onSubmitEditing={handlePasswordUnlock}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, (isProcessing || lockoutUntil > Date.now()) && styles.buttonDisabled]}
        onPress={handlePasswordUnlock}
        disabled={isProcessing || lockoutUntil > Date.now()}
      >
        {isProcessing ? (
          <ActivityIndicator color={theme.colors.onAccent} />
        ) : (
          <Text style={styles.buttonText}>Unlock</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.biometricButton} onPress={attemptBiometricUnlock}>
        <Text style={styles.biometricText}>Use Biometrics</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E17',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
  },
  title: {
    fontSize: typography.sizes.h1Sm,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: typography.sizes.bodySmall,
    color: '#9BA1B0',
    textAlign: 'center',
    marginBottom: spacing[8],
    lineHeight: 20,
  },
  input: {
    width: '100%',
    height: 52,
    backgroundColor: '#131720',
    borderRadius: 12,
    paddingHorizontal: spacing[4],
    color: '#FFFFFF',
    fontSize: typography.sizes.body,
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: '#1A1F2E',
  },
  error: {
    color: '#EF4444',
    fontSize: typography.sizes.label,
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  button: {
    width: '100%',
    height: 52,
    backgroundColor: '#10B981',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing[2],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.body,
    fontWeight: '600',
  },
  biometricButton: {
    marginTop: spacing[6],
    padding: spacing[3],
  },
  biometricText: {
    color: '#10B981',
    fontSize: typography.sizes.bodySmall,
    fontWeight: '500',
  },
});
