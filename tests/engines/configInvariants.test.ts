/**
 * Tests: Engine Configuration Invariants
 *
 * Target: PROGRESSION_CONFIG from progressionEngine, RECOVERY_CONFIG from recoveryEngine
 * Dependencies: These import DB-dependent modules, but we only test exported config objects
 * Risk: LOW — config structure validation only
 */

import { describe, it, expect } from 'vitest';
import { PROGRESSION_CONFIG } from '../../src/engines/progressionEngine';
import { RECOVERY_CONFIG } from '../../src/engines/recoveryEngine';

// ============================================
// PROGRESSION CONFIG INVARIANTS
// ============================================

describe('PROGRESSION_CONFIG', () => {
  it('has a success threshold between 0 and 1', () => {
    expect(PROGRESSION_CONFIG.success_threshold).toBeGreaterThan(0);
    expect(PROGRESSION_CONFIG.success_threshold).toBeLessThanOrEqual(1);
  });

  it('requires at least 1 success to progress', () => {
    expect(PROGRESSION_CONFIG.successes_to_progress).toBeGreaterThanOrEqual(1);
  });

  it('requires at least 1 failure to regress', () => {
    expect(PROGRESSION_CONFIG.failures_to_regress).toBeGreaterThanOrEqual(1);
  });

  it('has positive rep and set increments', () => {
    expect(PROGRESSION_CONFIG.rep_increment).toBeGreaterThan(0);
    expect(PROGRESSION_CONFIG.set_increment).toBeGreaterThan(0);
  });

  it('rep ceilings are above rep floors for all goal types', () => {
    const goals = ['strength', 'hypertrophy', 'endurance', 'default'] as const;
    for (const goal of goals) {
      expect(PROGRESSION_CONFIG.rep_ceilings[goal]).toBeGreaterThan(
        PROGRESSION_CONFIG.rep_floors[goal],
      );
    }
  });

  it('strength rep ceiling <= hypertrophy rep ceiling', () => {
    expect(PROGRESSION_CONFIG.rep_ceilings.strength).toBeLessThanOrEqual(
      PROGRESSION_CONFIG.rep_ceilings.hypertrophy,
    );
  });

  it('hypertrophy rep ceiling <= endurance rep ceiling', () => {
    expect(PROGRESSION_CONFIG.rep_ceilings.hypertrophy).toBeLessThanOrEqual(
      PROGRESSION_CONFIG.rep_ceilings.endurance,
    );
  });
});

// ============================================
// RECOVERY CONFIG INVARIANTS
// ============================================

describe('RECOVERY_CONFIG', () => {
  it('daily recovery rate is positive and reasonable', () => {
    expect(RECOVERY_CONFIG.daily_recovery_rate).toBeGreaterThan(0);
    expect(RECOVERY_CONFIG.daily_recovery_rate).toBeLessThanOrEqual(25);
  });

  it('fatigue thresholds are ordered: soft < hard < critical', () => {
    expect(RECOVERY_CONFIG.fatigue_soft_threshold).toBeLessThan(
      RECOVERY_CONFIG.fatigue_hard_threshold,
    );
    expect(RECOVERY_CONFIG.fatigue_hard_threshold).toBeLessThan(
      RECOVERY_CONFIG.fatigue_critical_threshold,
    );
  });

  it('fatigue thresholds are within 0-100 range', () => {
    expect(RECOVERY_CONFIG.fatigue_soft_threshold).toBeGreaterThanOrEqual(0);
    expect(RECOVERY_CONFIG.fatigue_critical_threshold).toBeLessThanOrEqual(100);
  });

  it('deload volume multiplier is a reduction (< 1.0)', () => {
    expect(RECOVERY_CONFIG.deload_volume_multiplier).toBeGreaterThan(0);
    expect(RECOVERY_CONFIG.deload_volume_multiplier).toBeLessThan(1);
  });

  it('scheduled deload interval is reasonable (2-8 weeks)', () => {
    expect(RECOVERY_CONFIG.scheduled_deload_weeks).toBeGreaterThanOrEqual(2);
    expect(RECOVERY_CONFIG.scheduled_deload_weeks).toBeLessThanOrEqual(8);
  });

  it('fatigue per set: primary > secondary', () => {
    expect(RECOVERY_CONFIG.fatigue_per_set_primary).toBeGreaterThan(
      RECOVERY_CONFIG.fatigue_per_set_secondary,
    );
  });

  it('recovery bonuses are positive', () => {
    expect(RECOVERY_CONFIG.sleep_recovery_bonus).toBeGreaterThan(0);
    expect(RECOVERY_CONFIG.rest_day_recovery_bonus).toBeGreaterThan(0);
  });

  it('deload duration is at least 3 days', () => {
    expect(RECOVERY_CONFIG.deload_duration_days).toBeGreaterThanOrEqual(3);
  });

  it('avg fatigue deload trigger is above soft threshold', () => {
    expect(RECOVERY_CONFIG.avg_fatigue_deload_trigger).toBeGreaterThan(
      RECOVERY_CONFIG.fatigue_soft_threshold,
    );
  });
});
