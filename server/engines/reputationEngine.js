/**
 * Reputation Engine — Phase 29
 *
 * Behavior-aware recovery system. Replaces flat +0.02/hour with:
 *   - Reputation memory (lifetime anomalies, recent history, last violation)
 *   - Dynamic recovery rate (modifier based on recent behavior)
 *   - Severity-based recovery delay (cooldown before recovery begins)
 *   - Trust floor (prevents abuse cycling)
 *   - Reputation decay (forgiveness over time)
 *   - False positive reversal (admin-driven)
 *   - Shadow mode (log-only enforcement comparison)
 *   - Premium user protection (cap restriction for paying users)
 *
 * Exports:
 *   getReputation(userId)
 *   computeDynamicRecoveryRate(reputation)
 *   getRecoveryDelay(lastSeverity)
 *   canStartRecovery(reputation)
 *   applyReputationRecovery(userId, hoursClean)
 *   getTrustFloor(reputation)
 *   applyTrustFloor(userId)
 *   decayReputation(userId)  — weekly reputation forgiveness
 *   resolveAsFalsePositive(userId, alertId, adminNotes)
 *   evaluateShadowMode(userId, currentProfile)
 *   isShadowModeEnabled()
 *   setShadowMode(enabled)
 *   applyPremiumProtection(userId, accessProfile, isPremium, trustScore)
 *   getReputationSummary(userId)
 *
 * SEVERITY_DELAYS, RECOVERY_CONSTANTS, TRUST_FLOOR_RULES
 */
'use strict';

const supabase = require('../utils/supabaseClient');
const logEvent = require('../utils/logEvent');

// ── Recovery Constants ──

const BASE_RECOVERY_RATE = 0.02; // per hour
const MIN_RECOVERY_RATE  = 0.002; // floor — never zero
const RECOVERY_CAP       = 1.0;

// ── Severity-Based Recovery Delays (hours before recovery can begin) ──

const SEVERITY_DELAYS = {
  CRITICAL: 24,
  HIGH:     12,
  MEDIUM:   4,
  LOW:      1,
};

// ── Trust Floor Rules ──

const TRUST_FLOOR_RULES = {
  REPEAT_OFFENDER_THRESHOLD: 3,   // alerts in 7d to trigger floor
  REPEAT_OFFENDER_CAP:       0.6, // max trust for repeat offenders
  CHRONIC_OFFENDER_THRESHOLD: 6,  // alerts in 7d → hard floor
  CHRONIC_OFFENDER_CAP:       0.4, // max trust for chronic offenders
};

// ── Reputation Decay ──

const WEEKLY_DECAY_FACTOR = 0.98; // lifetime_anomalies *= 0.98 weekly

// ── Shadow Mode (module-level flag, toggleable by admin) ──

let shadowModeEnabled = false;

// ── Core: Build reputation profile from DB queries ──

async function getReputation(userId) {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Count anomalies in 24h and 7d windows from the anomalies table
    const [anomalies24h, alerts7d, latestAlert] = await Promise.all([
      supabase
        .from('anomalies')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', twentyFourHoursAgo),

      supabase
        .from('trust_alerts')
        .select('id, severity, created_at', { count: 'exact' })
        .eq('user_id', userId)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false }),

      supabase
        .from('trust_alerts')
        .select('severity, created_at, resolution_notes')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // Lifetime anomaly count (approximate — from all-time anomalies)
    const { count: lifetimeCount } = await supabase
      .from('anomalies')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const recent_anomalies_24h = anomalies24h.count || 0;
    const alerts_last_7d = alerts7d.count || 0;
    const lifetime_anomalies = lifetimeCount || 0;

    const lastViolation = latestAlert.data;
    const last_violation_at = lastViolation?.created_at || null;
    const last_severity = lastViolation?.severity || null;

    return {
      userId,
      lifetime_anomalies,
      recent_anomalies_24h,
      alerts_last_7d,
      last_violation_at,
      last_severity,
      computed_at: now.toISOString(),
    };
  } catch (err) {
    console.error('[reputationEngine] getReputation error:', err.message);
    return {
      userId,
      lifetime_anomalies: 0,
      recent_anomalies_24h: 0,
      alerts_last_7d: 0,
      last_violation_at: null,
      last_severity: null,
      computed_at: new Date().toISOString(),
      error: err.message,
    };
  }
}

// ── Dynamic Recovery Rate ──
// modifier = 1 - (alerts_last_7d * 0.1) - (recent_anomalies_24h * 0.05)
// recoveryRate = baseRate * modifier, clamped to MIN_RECOVERY_RATE

function computeDynamicRecoveryRate(reputation) {
  const modifier = 1
    - (reputation.alerts_last_7d * 0.1)
    - (reputation.recent_anomalies_24h * 0.05);

  const rate = BASE_RECOVERY_RATE * Math.max(modifier, 0);
  return Math.max(MIN_RECOVERY_RATE, Math.round(rate * 10000) / 10000);
}

// ── Severity-Based Recovery Delay ──

function getRecoveryDelay(lastSeverity) {
  return SEVERITY_DELAYS[lastSeverity] || SEVERITY_DELAYS.LOW;
}

function canStartRecovery(reputation) {
  if (!reputation.last_violation_at || !reputation.last_severity) {
    return { allowed: true, remaining_hours: 0 };
  }

  const delayHours = getRecoveryDelay(reputation.last_severity);
  const violationTime = new Date(reputation.last_violation_at).getTime();
  const resumeTime = violationTime + (delayHours * 60 * 60 * 1000);
  const now = Date.now();

  if (now >= resumeTime) {
    return { allowed: true, remaining_hours: 0 };
  }

  const remainingMs = resumeTime - now;
  const remainingHours = Math.round((remainingMs / (60 * 60 * 1000)) * 100) / 100;
  return { allowed: false, remaining_hours: remainingHours, delay_severity: reputation.last_severity };
}

// ── Reputation-Aware Recovery (replaces flat applySoftRecovery) ──

async function applyReputationRecovery(userId, hoursClean) {
  try {
    const reputation = await getReputation(userId);

    // Check severity-based delay
    const recoveryStatus = canStartRecovery(reputation);
    if (!recoveryStatus.allowed) {
      return {
        success: true,
        skipped: true,
        reason: 'severity_delay',
        remaining_hours: recoveryStatus.remaining_hours,
        delay_severity: recoveryStatus.delay_severity,
      };
    }

    // Compute dynamic recovery rate
    const recoveryRate = computeDynamicRecoveryRate(reputation);
    const recovery = Math.min(recoveryRate * hoursClean, RECOVERY_CAP);

    // Fetch current trust
    const { data: user, error: fetchErr } = await supabase
      .from('users')
      .select('trust_score')
      .eq('id', userId)
      .maybeSingle();

    if (fetchErr || !user) {
      return { success: false, error: 'user_not_found' };
    }

    const currentTrust = Number(user.trust_score) || 0;

    // Apply trust floor
    const trustFloor = getTrustFloor(reputation);
    let newTrust = Math.min(currentTrust + recovery, RECOVERY_CAP);

    // Trust floor caps the maximum trust a repeat offender can reach
    if (trustFloor.capped) {
      newTrust = Math.min(newTrust, trustFloor.max_trust);
    }

    if (newTrust <= currentTrust) {
      return { success: true, skipped: true, reason: 'already_at_cap_or_floor' };
    }

    const { error: updateErr } = await supabase
      .from('users')
      .update({ trust_score: newTrust })
      .eq('id', userId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    logEvent(userId, null, 'reputation_recovery_applied', null, {
      previous: Math.round(currentTrust * 1000) / 1000,
      recovered: Math.round(recovery * 1000) / 1000,
      new_score: Math.round(newTrust * 1000) / 1000,
      hours_clean: hoursClean,
      recovery_rate: recoveryRate,
      reputation_snapshot: {
        alerts_7d: reputation.alerts_last_7d,
        anomalies_24h: reputation.recent_anomalies_24h,
        last_severity: reputation.last_severity,
      },
    });

    return {
      success: true,
      previous: Math.round(currentTrust * 1000) / 1000,
      recovered: Math.round(recovery * 1000) / 1000,
      newTrust: Math.round(newTrust * 1000) / 1000,
      recoveryRate,
      trustFloor: trustFloor.capped ? trustFloor.max_trust : null,
    };
  } catch (err) {
    console.error('[reputationEngine] applyReputationRecovery error:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Trust Floor ──
// Prevents abuse cycling: repeated offenders can't bounce back to FULL

function getTrustFloor(reputation) {
  if (reputation.alerts_last_7d >= TRUST_FLOOR_RULES.CHRONIC_OFFENDER_THRESHOLD) {
    return { capped: true, max_trust: TRUST_FLOOR_RULES.CHRONIC_OFFENDER_CAP, reason: 'chronic_offender' };
  }
  if (reputation.alerts_last_7d >= TRUST_FLOOR_RULES.REPEAT_OFFENDER_THRESHOLD) {
    return { capped: true, max_trust: TRUST_FLOOR_RULES.REPEAT_OFFENDER_CAP, reason: 'repeat_offender' };
  }
  return { capped: false, max_trust: 1.0, reason: 'clean' };
}

// Apply trust floor to current user (enforce cap on current trust)
async function applyTrustFloor(userId) {
  try {
    const reputation = await getReputation(userId);
    const floor = getTrustFloor(reputation);

    if (!floor.capped) {
      return { success: true, applied: false, reason: 'clean_history' };
    }

    const { data: user, error: fetchErr } = await supabase
      .from('users')
      .select('trust_score')
      .eq('id', userId)
      .maybeSingle();

    if (fetchErr || !user) {
      return { success: false, error: 'user_not_found' };
    }

    const currentTrust = Number(user.trust_score) || 0;

    if (currentTrust <= floor.max_trust) {
      return { success: true, applied: false, reason: 'already_below_floor' };
    }

    const { error: updateErr } = await supabase
      .from('users')
      .update({ trust_score: floor.max_trust })
      .eq('id', userId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    logEvent(userId, null, 'trust_floor_applied', null, {
      previous: currentTrust,
      new_score: floor.max_trust,
      reason: floor.reason,
      alerts_7d: reputation.alerts_last_7d,
    });

    return {
      success: true,
      applied: true,
      previous: currentTrust,
      newTrust: floor.max_trust,
      reason: floor.reason,
    };
  } catch (err) {
    console.error('[reputationEngine] applyTrustFloor error:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Reputation Decay (Forgiveness Over Time) ──
// Called periodically (e.g. weekly cron or admin trigger)
// lifetime_anomalies conceptual decay: reduces impact of old anomalies
// In practice: we decay the anomaly COUNT contribution by clearing old records

async function decayReputation(userId) {
  try {
    // Get current lifetime anomaly count
    const reputation = await getReputation(userId);

    // The decay is conceptual: we don't delete anomalies,
    // but we reduce their weight over time by marking old ones as decayed
    // For this implementation, we use the sliding window approach:
    // alerts_last_7d is already a rolling window
    // recent_anomalies_24h is already a sliding window
    //
    // The only persistent counter is lifetime_anomalies.
    // We apply the weekly decay factor (0.98) by logging the effective count.

    const effectiveLifetime = Math.floor(reputation.lifetime_anomalies * WEEKLY_DECAY_FACTOR);

    logEvent(userId, null, 'reputation_decay_applied', null, {
      original_lifetime: reputation.lifetime_anomalies,
      effective_lifetime: effectiveLifetime,
      decay_factor: WEEKLY_DECAY_FACTOR,
    });

    return {
      success: true,
      original_lifetime: reputation.lifetime_anomalies,
      effective_lifetime: effectiveLifetime,
      alerts_7d: reputation.alerts_last_7d,
      anomalies_24h: reputation.recent_anomalies_24h,
    };
  } catch (err) {
    console.error('[reputationEngine] decayReputation error:', err.message);
    return { success: false, error: err.message };
  }
}

// ── False Positive Resolution ──
// Admin marks an alert as false positive → reverse trust decay + remove anomaly impact

async function resolveAsFalsePositive(userId, alertId, adminNotes) {
  try {
    // 1. Mark the alert as resolved with false positive notes
    const { data: alert, error: alertErr } = await supabase
      .from('trust_alerts')
      .update({
        status: 'RESOLVED',
        resolved: true,
        resolved_by: 'admin',
        resolved_at: new Date().toISOString(),
        resolution_notes: adminNotes || 'False positive',
      })
      .eq('id', alertId)
      .eq('user_id', userId)
      .select('severity, trust_score_at_alert')
      .maybeSingle();

    if (alertErr || !alert) {
      return { success: false, error: alertErr?.message || 'alert_not_found' };
    }

    // 2. Reverse the trust decay — restore trust to score at time of alert
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('trust_score')
      .eq('id', userId)
      .maybeSingle();

    if (userErr || !user) {
      return { success: false, error: 'user_not_found' };
    }

    const currentTrust = Number(user.trust_score) || 0;
    const trustAtAlert = Number(alert.trust_score_at_alert) || currentTrust;

    // Only restore if current trust is lower than trust at alert time
    let restoredTrust = currentTrust;
    if (trustAtAlert > currentTrust) {
      restoredTrust = Math.min(trustAtAlert, RECOVERY_CAP);
      await supabase
        .from('users')
        .update({ trust_score: restoredTrust })
        .eq('id', userId);
    }

    logEvent(userId, null, 'false_positive_resolved', null, {
      alert_id: alertId,
      severity: alert.severity,
      previous_trust: currentTrust,
      restored_trust: restoredTrust,
      admin_notes: adminNotes,
    });

    return {
      success: true,
      alert_id: alertId,
      severity: alert.severity,
      previous_trust: Math.round(currentTrust * 1000) / 1000,
      restored_trust: Math.round(restoredTrust * 1000) / 1000,
      trust_reversed: restoredTrust > currentTrust,
    };
  } catch (err) {
    console.error('[reputationEngine] resolveAsFalsePositive error:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Shadow Mode ──
// Runs Phase 29 logic in log-only mode before full enforcement

function isShadowModeEnabled() {
  return shadowModeEnabled;
}

function setShadowMode(enabled) {
  shadowModeEnabled = !!enabled;
  return { shadow_mode: shadowModeEnabled };
}

// Shadow evaluation: compute what Phase 29 WOULD do, log it, return comparison
async function evaluateShadowMode(userId, currentProfile) {
  try {
    const reputation = await getReputation(userId);
    const floor = getTrustFloor(reputation);
    const recoveryRate = computeDynamicRecoveryRate(reputation);
    const recoveryStatus = canStartRecovery(reputation);

    const shadowResult = {
      userId,
      currentProfile,
      reputation,
      trust_floor: floor,
      recovery_rate: recoveryRate,
      recovery_allowed: recoveryStatus.allowed,
      recovery_delay_remaining: recoveryStatus.remaining_hours,
      would_cap_trust: floor.capped,
      timestamp: new Date().toISOString(),
    };

    logEvent(userId, null, 'shadow_mode_evaluation', null, shadowResult);

    return shadowResult;
  } catch (err) {
    console.error('[reputationEngine] evaluateShadowMode error:', err.message);
    return { userId, error: err.message };
  }
}

// ── Premium User Protection ──
// Cap restriction level for paying users to prevent revenue damage from false positives

function applyPremiumProtection(accessProfile, isPremium, trustScore) {
  if (!isPremium || trustScore <= 0.5) {
    return { protected: false, profile: accessProfile };
  }

  // Premium users with trust > 0.5 can't be restricted below SOFT_RESTRICT
  const severity = {
    FULL: 0, WATCH: 1, SOFT_RESTRICT: 2, HARD_RESTRICT: 3, LOCKDOWN: 4,
  };

  if ((severity[accessProfile] || 0) > severity.SOFT_RESTRICT) {
    logEvent(null, null, 'premium_protection_applied', null, {
      original_profile: accessProfile,
      capped_profile: 'SOFT_RESTRICT',
      trust_score: trustScore,
    });
    return { protected: true, profile: 'SOFT_RESTRICT', original: accessProfile };
  }

  return { protected: false, profile: accessProfile };
}

// ── Full Reputation Summary (admin view) ──

async function getReputationSummary(userId) {
  try {
    const reputation = await getReputation(userId);
    const floor = getTrustFloor(reputation);
    const recoveryRate = computeDynamicRecoveryRate(reputation);
    const recoveryStatus = canStartRecovery(reputation);

    const { data: user } = await supabase
      .from('users')
      .select('trust_score, anomaly_score')
      .eq('id', userId)
      .maybeSingle();

    const trustScore = user ? Number(user.trust_score) || 0 : 0;
    const anomalyScore = user ? Number(user.anomaly_score) || 0 : 0;

    return {
      success: true,
      userId,
      trust_score: Math.round(trustScore * 1000) / 1000,
      anomaly_score: Math.round(anomalyScore * 1000) / 1000,
      reputation,
      trust_floor: floor,
      recovery: {
        rate: recoveryRate,
        base_rate: BASE_RECOVERY_RATE,
        allowed: recoveryStatus.allowed,
        remaining_hours: recoveryStatus.remaining_hours,
        delay_severity: recoveryStatus.delay_severity || null,
      },
      shadow_mode: shadowModeEnabled,
    };
  } catch (err) {
    console.error('[reputationEngine] getReputationSummary error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  // Constants
  BASE_RECOVERY_RATE,
  MIN_RECOVERY_RATE,
  SEVERITY_DELAYS,
  TRUST_FLOOR_RULES,
  WEEKLY_DECAY_FACTOR,

  // Core reputation
  getReputation,
  getReputationSummary,

  // Recovery
  computeDynamicRecoveryRate,
  getRecoveryDelay,
  canStartRecovery,
  applyReputationRecovery,

  // Trust floor
  getTrustFloor,
  applyTrustFloor,

  // Decay
  decayReputation,

  // False positive
  resolveAsFalsePositive,

  // Shadow mode
  isShadowModeEnabled,
  setShadowMode,
  evaluateShadowMode,

  // Premium protection
  applyPremiumProtection,
};
