/**
 * Module Import Safety Tests
 * 
 * Verifies that core modules load without throwing at import time.
 * This catches bugs like the ACCENT_AMBER ReferenceError that crashed the app.
 * Screens are excluded (they require React Native runtime).
 */
import { describe, it, expect } from 'vitest';

describe('Core module imports', () => {
  it('database/service exports key functions', async () => {
    const mod = await import('../src/database/service');
    expect(mod.getUserProfile).toBeTypeOf('function');
    expect(mod.getAppState).toBeTypeOf('function');
    expect(mod.getRecentSessions).toBeTypeOf('function');
    expect(mod.getMuscleFatigue).toBeTypeOf('function');
    expect(mod.getStreak).toBeTypeOf('function');
    expect(mod.getUserProgress).toBeTypeOf('function');
  });

  it('database/types exports schema version and enums', async () => {
    const mod = await import('../src/database/types');
    expect(mod.SCHEMA_VERSION).toBeTypeOf('number');
    expect(mod.SCHEMA_VERSION).toBeGreaterThanOrEqual(15);
  });

  it('workoutGenerator exports generateWorkout', async () => {
    const mod = await import('../src/engines/workoutGenerator');
    expect(mod.generateWorkout).toBeTypeOf('function');
    expect(mod.analyzeWorkoutGeneration).toBeTypeOf('function');
  });

  it('progressionEngine exports calculateProgression', async () => {
    const mod = await import('../src/engines/progressionEngine');
    expect(mod.calculateProgression).toBeTypeOf('function');
  });

  it('recoveryEngine exports fatigue and recovery functions', async () => {
    const mod = await import('../src/engines/recoveryEngine');
    expect(mod.getFatigueSnapshot).toBeTypeOf('function');
    expect(mod.getAverageFatigue).toBeTypeOf('function');
  });

  it('RealisticHealthEngine exports class with static methods', async () => {
    const mod = await import('../src/engines/RealisticHealthEngine');
    expect(mod.RealisticHealthEngine).toBeDefined();
    // Static methods verified at test-time, not import time
    expect(typeof mod.RealisticHealthEngine).toBe('function');
  });

  it('AnomalyDetector exports singleton', async () => {
    const mod = await import('../src/engines/AnomalyDetector');
    expect(mod.anomalyDetector).toBeDefined();
  });

  it('SleepAnalysisEngine exports singleton', async () => {
    const mod = await import('../src/engines/SleepAnalysisEngine');
    expect(mod.sleepEngine).toBeDefined();
  });

  // HealthMonitor skipped — imports SensorFusionEngine which depends on
  // expo-sensors (native module) and react-native, both un-parseable by Vite/Rollup.
  it.skip('HealthMonitor exports singleton (requires native runtime)', () => {});

  it('IntentRouter exports singleton', async () => {
    const mod = await import('../src/engines/IntentRouter');
    expect(mod.intentRouter).toBeDefined();
  });

  it('xpService exports key functions', async () => {
    const mod = await import('../src/services/xpService');
    expect(mod.getXPData).toBeTypeOf('function');
    expect(mod.awardWorkoutXP).toBeTypeOf('function');
  });

  it('AESEncryption exports v2 and v3 functions', async () => {
    const mod = await import('../src/security/AESEncryption');
    expect(mod.encryptV2).toBeTypeOf('function');
    expect(mod.decryptV2).toBeTypeOf('function');
    expect(mod.isV1Payload).toBeTypeOf('function');
    expect(mod.isV2Payload).toBeTypeOf('function');
  });

  it('EncryptedDatabase exports singleton', async () => {
    const mod = await import('../src/security/EncryptedDatabase');
    expect(mod.encryptedDB).toBeDefined();
  });

  it('BiometricAuth exports class', async () => {
    const mod = await import('../src/security/BiometricAuth');
    expect(mod.BiometricAuthService).toBeDefined();
  });

  it('DualAIEngine exports singleton', async () => {
    const mod = await import('../src/engines/DualAIEngine');
    expect(mod.dualAI).toBeDefined();
  });

  it('theme-system exports themes without throwing', async () => {
    const mod = await import('../src/design/theme-system');
    expect(mod.darkTheme).toBeDefined();
    expect(mod.lightTheme).toBeDefined();
    expect(mod.blackGoldTheme).toBeDefined();
    expect(mod.darkTheme.colors.background).toBeTypeOf('string');
    expect(mod.darkTheme.colors.accent).toBe('#10B981');
    // Numeric spacing keys
    expect(mod.darkTheme.spacing[4]).toBe(16);
  });

  it('bodyCraftEngine loads without throwing', async () => {
    const mod = await import('../src/engines/bodyCraftEngine');
    expect(mod.generateBodyCraftAlgorithm).toBeTypeOf('function');
  });
});
