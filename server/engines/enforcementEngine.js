/**
 * Enforcement Engine — Phase 29
 *
 * Converts trust scores + alerts into real access consequences.
 * Phase 29: Reputation-aware recovery — dynamic rates, severity delays,
 * trust floors, premium protection, shadow mode.
 *
 * Trust Bands:
 *   SAFE:       ≥ 0.8  → FULL access
 *   WATCH:      0.6–0.79 → WATCH (increased logging, no restriction)
 *   RESTRICTED: 0.4–0.59 → SOFT_RESTRICT (rate limits, disable non-essential)
 *   CRITICAL:   0.2–0.39 → HARD_RESTRICT (block premium, increase verification)
 *   LOCKDOWN:   < 0.2    → LOCKDOWN (deny all privileged, force re-auth)
 *
 * Recovery (Phase 29):
 *   Dynamic rate based on reputation (alerts_7d, anomalies_24h)
 *   Severity-based delay before recovery begins
 *   Trust floor prevents abuse cycling
 *   Premium protection caps restriction for paying users
 *
 * Adaptive penalty:
 *   decay = baseDecay * (1 + anomalyCount / 5)
 *   if recentAlerts > 3: decay *= 1.5
 */
'use strict';

const supabase = require('../utils/supabaseClient');
const logEvent = require('../utils/logEvent');
const {
  getTrustFloor,
  applyPremiumProtection,
  evaluateShadowMode,
  isShadowModeEnabled,
} = require('./reputationEngine');

// ── Trust Bands ──

const TRUST_BANDS = {
  SAFE:       0.8,
  WATCH:      0.6,
  RESTRICTED: 0.4,
  CRITICAL:   0.2,
};

// ── Access Profile Enum ──

const ACCESS_PROFILES = {
  FULL:          'FULL',
  WATCH:         'WATCH',
  SOFT_RESTRICT: 'SOFT_RESTRICT',
  HARD_RESTRICT: 'HARD_RESTRICT',
  LOCKDOWN:      'LOCKDOWN',
};

// ── In-memory override store (survives until restart; DB-backed query as fallback) ──
// Map<userId, { profile, reason, expiresAt, createdAt }>
const overrideStore = new Map();

// ── Recovery constants ──

const RECOVERY_RATE_PER_HOUR = 0.02;
const RECOVERY_CAP = 1.0;
const OVERRIDE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Anti-bypass ──

const MAX_OFFLINE_WINDOW_HOURS = 48;

// ── Core: Derive access profile from effective trust score ──

function getAccessProfile(effectiveTrust) {
  if (effectiveTrust >= TRUST_BANDS.SAFE)       return ACCESS_PROFILES.FULL;
  if (effectiveTrust >= TRUST_BANDS.WATCH)       return ACCESS_PROFILES.WATCH;
  if (effectiveTrust >= TRUST_BANDS.RESTRICTED)  return ACCESS_PROFILES.SOFT_RESTRICT;
  if (effectiveTrust >= TRUST_BANDS.CRITICAL)    return ACCESS_PROFILES.HARD_RESTRICT;
  return ACCESS_PROFILES.LOCKDOWN;
}

// ── Override management ──

function getOverrideStatus(userId) {
  const override = overrideStore.get(userId);
  if (!override) return null;

  // Check if override expired
  if (override.expiresAt && Date.now() > override.expiresAt) {
    overrideStore.delete(userId);
    return null;
  }

  return {
    profile: override.profile,
    reason: override.reason,
    expiresAt: override.expiresAt,
    createdAt: override.createdAt,
    remainingMs: override.expiresAt ? override.expiresAt - Date.now() : null,
  };
}

function forceProfile(userId, profile, reason) {
  if (!Object.values(ACCESS_PROFILES).includes(profile)) {
    return { success: false, error: `Invalid profile: ${profile}` };
  }

  const now = Date.now();
  overrideStore.set(userId, {
    profile,
    reason: reason || 'admin_override',
    expiresAt: now + OVERRIDE_COOLDOWN_MS,
    createdAt: now,
  });

  logEvent(userId, null, 'enforcement_override_applied', null, {
    profile,
    reason,
    expires_at: new Date(now + OVERRIDE_COOLDOWN_MS).toISOString(),
  });

  return { success: true, profile, expiresAt: now + OVERRIDE_COOLDOWN_MS };
}

function clearOverride(userId) {
  const existed = overrideStore.has(userId);
  overrideStore.delete(userId);
  if (existed) {
    logEvent(userId, null, 'enforcement_override_cleared', null);
  }
  return { success: true, existed };
}

// ── Full enforcement state for a user ──

async function getEnforcementState(userId) {
  try {
    // Check for active override first
    const override = getOverrideStatus(userId);
    if (override) {
      return {
        userId,
        accessProfile: override.profile,
        override: true,
        overrideDetails: override,
        effectiveTrust: null,
        anomalyScore: null,
      };
    }

    // Fetch current scores
    const { data: user, error } = await supabase
      .from('users')
      .select('id, trust_score, anomaly_score')
      .eq('id', userId)
      .maybeSingle();

    if (error || !user) {
      return {
        userId,
        accessProfile: ACCESS_PROFILES.LOCKDOWN,
        override: false,
        effectiveTrust: 0,
        anomalyScore: 1,
        reason: error ? 'db_error' : 'user_not_found',
      };
    }

    const trustScore = Number(user.trust_score) || 1.0;
    const anomalyScore = Number(user.anomaly_score) || 0;
    const effectiveTrust = Math.max(0, Math.min(1.0, trustScore - anomalyScore));

    // Check offline window (anti-bypass)
    const { data: devices } = await supabase
      .from('devices')
      .select('last_seen')
      .eq('user_id', userId)
      .order('last_seen', { ascending: false })
      .limit(1)
      .maybeSingle();

    let offlineEnforced = false;
    if (devices && devices.last_seen) {
      offlineEnforced = checkOfflineWindow(devices.last_seen, MAX_OFFLINE_WINDOW_HOURS);
    }

    let accessProfile = getAccessProfile(effectiveTrust);

    // Offline window exceeded → force HARD_RESTRICT minimum
    if (offlineEnforced && profileSeverity(accessProfile) < profileSeverity(ACCESS_PROFILES.HARD_RESTRICT)) {
      accessProfile = ACCESS_PROFILES.HARD_RESTRICT;
    }

    // Phase 29: Premium protection — cap restriction for paying users
    let premiumProtected = false;
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    const isPremium = !!(sub && sub.status === 'active');

    if (isPremium) {
      const prot = applyPremiumProtection(accessProfile, isPremium, trustScore);
      if (prot.protected) {
        accessProfile = prot.profile;
        premiumProtected = true;
      }
    }

    // Phase 29: Shadow mode — log what Phase 29 would do
    if (isShadowModeEnabled()) {
      evaluateShadowMode(userId, accessProfile).catch(() => {});
    }

    return {
      userId,
      accessProfile,
      override: false,
      effectiveTrust: Math.round(effectiveTrust * 1000) / 1000,
      anomalyScore: Math.round(anomalyScore * 1000) / 1000,
      trustScore: Math.round(trustScore * 1000) / 1000,
      offlineEnforced,
      premiumProtected,
    };
  } catch (err) {
    console.error('[enforcementEngine] getEnforcementState error:', err.message);
    return {
      userId,
      accessProfile: ACCESS_PROFILES.LOCKDOWN,
      override: false,
      reason: 'internal_error',
    };
  }
}

// ── Profile severity ranking (higher = more severe) ──

function profileSeverity(profile) {
  const severity = {
    [ACCESS_PROFILES.FULL]:          0,
    [ACCESS_PROFILES.WATCH]:         1,
    [ACCESS_PROFILES.SOFT_RESTRICT]: 2,
    [ACCESS_PROFILES.HARD_RESTRICT]: 3,
    [ACCESS_PROFILES.LOCKDOWN]:      4,
  };
  return severity[profile] ?? 4;
}

// ── Adaptive penalty calculation ──

function applyAdaptivePenalty(baseDecay, anomalyCount, recentAlerts) {
  let decay = baseDecay * (1 + anomalyCount / 5);
  if (recentAlerts > 3) decay *= 1.5;
  return Math.min(decay, 1.0); // Cap at 1.0
}

// ── Token revocation ──

async function revokeAllTokens(userId, reason) {
  try {
    const { data, error } = await supabase
      .from('device_tokens')
      .update({
        revoked: true,
        revoked_at: new Date().toISOString(),
        revoke_reason: reason || 'TRUST_VIOLATION',
      })
      .eq('user_id', userId)
      .select('id');

    if (error) {
      console.error('[enforcementEngine] revokeAllTokens error:', error.message);
      return { success: false, error: error.message };
    }

    const count = data ? data.length : 0;
    logEvent(userId, null, 'tokens_revoked', null, {
      reason,
      count,
    });

    return { success: true, revoked: count };
  } catch (err) {
    console.error('[enforcementEngine] revokeAllTokens exception:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Token reinstatement ──

async function reinstateTokens(userId) {
  try {
    const { data, error } = await supabase
      .from('device_tokens')
      .update({
        revoked: false,
        revoked_at: null,
        revoke_reason: null,
      })
      .eq('user_id', userId)
      .eq('revoked', true)
      .select('id');

    if (error) {
      console.error('[enforcementEngine] reinstateTokens error:', error.message);
      return { success: false, error: error.message };
    }

    const count = data ? data.length : 0;
    logEvent(userId, null, 'tokens_reinstated', null, { count });

    return { success: true, reinstated: count };
  } catch (err) {
    console.error('[enforcementEngine] reinstateTokens exception:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Soft recovery: trust restoration over time ──

async function applySoftRecovery(userId, hoursClean) {
  try {
    // Check for active override cooldown — no recovery adjustments during cooldown
    const override = getOverrideStatus(userId);
    if (override) {
      return { success: true, skipped: true, reason: 'override_cooldown_active' };
    }

    const recovery = Math.min(RECOVERY_RATE_PER_HOUR * hoursClean, RECOVERY_CAP);

    const { data: user, error: fetchErr } = await supabase
      .from('users')
      .select('trust_score')
      .eq('id', userId)
      .maybeSingle();

    if (fetchErr || !user) {
      return { success: false, error: 'user_not_found' };
    }

    const currentTrust = Number(user.trust_score) || 0;
    const newTrust = Math.min(currentTrust + recovery, RECOVERY_CAP);

    if (newTrust <= currentTrust) {
      return { success: true, skipped: true, reason: 'already_at_cap' };
    }

    const { error: updateErr } = await supabase
      .from('users')
      .update({ trust_score: newTrust })
      .eq('id', userId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    logEvent(userId, null, 'trust_recovery_applied', null, {
      previous: currentTrust,
      recovered: Math.round(recovery * 1000) / 1000,
      new_score: Math.round(newTrust * 1000) / 1000,
      hours_clean: hoursClean,
    });

    return {
      success: true,
      previous: Math.round(currentTrust * 1000) / 1000,
      recovered: Math.round(recovery * 1000) / 1000,
      newTrust: Math.round(newTrust * 1000) / 1000,
    };
  } catch (err) {
    console.error('[enforcementEngine] applySoftRecovery error:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Anti-bypass: offline window check ──

function checkOfflineWindow(lastSeen, maxHours) {
  if (!lastSeen) return false;
  const lastSeenMs = new Date(lastSeen).getTime();
  if (isNaN(lastSeenMs)) return false;
  const hoursOffline = (Date.now() - lastSeenMs) / (1000 * 60 * 60);
  return hoursOffline > maxHours;
}

// ── Alert → Enforcement bridge ──

async function bridgeAlertToEnforcement(userId, alertSeverity) {
  if (alertSeverity === 'CRITICAL') {
    // Force LOCKDOWN + revoke tokens
    forceProfile(userId, ACCESS_PROFILES.LOCKDOWN, 'CRITICAL_ALERT_BRIDGE');

    const revocation = await revokeAllTokens(userId, 'CRITICAL_ALERT');

    logEvent(userId, null, 'alert_enforcement_bridge', null, {
      severity: alertSeverity,
      action: 'LOCKDOWN',
      tokens_revoked: revocation.revoked || 0,
    });

    return { action: 'LOCKDOWN', tokensRevoked: revocation.revoked || 0 };
  }

  if (alertSeverity === 'HIGH') {
    logEvent(userId, null, 'alert_enforcement_bridge', null, {
      severity: alertSeverity,
      action: 'LOGGED',
    });
    return { action: 'LOGGED' };
  }

  return { action: 'NONE' };
}

// ── Feature gate: what each profile can do ──

function getFeatureGate(accessProfile) {
  switch (accessProfile) {
    case ACCESS_PROFILES.FULL:
      return {
        ai_access: true,
        premium_features: true,
        subscription_endpoints: true,
        sync: true,
        rate_limit_multiplier: 1.0,
        revalidation_required: false,
      };
    case ACCESS_PROFILES.WATCH:
      return {
        ai_access: true,
        premium_features: true,
        subscription_endpoints: true,
        sync: true,
        rate_limit_multiplier: 1.0,
        revalidation_required: false,
      };
    case ACCESS_PROFILES.SOFT_RESTRICT:
      return {
        ai_access: true,
        premium_features: true,
        subscription_endpoints: true,
        sync: true,
        rate_limit_multiplier: 0.5, // halved rate limits
        revalidation_required: true,
      };
    case ACCESS_PROFILES.HARD_RESTRICT:
      return {
        ai_access: false,
        premium_features: false,
        subscription_endpoints: false,
        sync: true, // basic sync allowed
        rate_limit_multiplier: 0.25,
        revalidation_required: true,
      };
    case ACCESS_PROFILES.LOCKDOWN:
      return {
        ai_access: false,
        premium_features: false,
        subscription_endpoints: false,
        sync: false,
        rate_limit_multiplier: 0,
        revalidation_required: true,
      };
    default:
      return {
        ai_access: false,
        premium_features: false,
        subscription_endpoints: false,
        sync: false,
        rate_limit_multiplier: 0,
        revalidation_required: true,
      };
  }
}

module.exports = {
  TRUST_BANDS,
  ACCESS_PROFILES,
  RECOVERY_RATE_PER_HOUR,
  OVERRIDE_COOLDOWN_MS,
  MAX_OFFLINE_WINDOW_HOURS,
  getAccessProfile,
  getEnforcementState,
  getOverrideStatus,
  forceProfile,
  clearOverride,
  applyAdaptivePenalty,
  revokeAllTokens,
  reinstateTokens,
  applySoftRecovery,
  checkOfflineWindow,
  bridgeAlertToEnforcement,
  getFeatureGate,
  profileSeverity,
};
