/**
 * Phase 30 — Adaptive Response Engine
 *
 * Moves from static enforcement → context-aware, evolving countermeasures.
 *
 * Response types:
 *   NONE          — no action
 *   FRICTION      — increase latency, add cooldowns, throttle endpoints
 *   SHADOW        — allow access but degrade (partial data, delayed sync)
 *   ISOLATE       — disable specific features (AI, sync, premium validation)
 *   HARD_RESTRICT — full enforcement (block privileged access)
 *
 * Decision model:
 *   inputs:  trust_score, anomaly_count, threat_score, anomaly_types, time_window, offline_duration
 *   output:  { response_type, intensity, duration_ms, reason, features_affected }
 *
 * Anti-pattern detection:
 *   - Repeated offline bypass attempts
 *   - Rapid subscription toggling
 *   - Multi-device anomaly spikes
 *   - Tamper + speed combo
 *   → increase response intensity multiplier
 */
'use strict';

require('dotenv').config({ quiet: true });
const supabase = require('../utils/supabaseClient');

// ── Constants ──

const RESPONSE_TYPES = {
  NONE: 'NONE',
  FRICTION: 'FRICTION',
  SHADOW: 'SHADOW',
  ISOLATE: 'ISOLATE',
  HARD_RESTRICT: 'HARD_RESTRICT',
};

// Threat → response mapping thresholds
const RESPONSE_THRESHOLDS = {
  FRICTION:      { min_threat: 5,  max_threat: 12 },
  SHADOW:        { min_threat: 10, max_threat: 20 },
  ISOLATE:       { min_threat: 18, max_threat: 30 },
  HARD_RESTRICT: { min_threat: 28, max_threat: Infinity },
};

// Duration by response type (ms)
const DEFAULT_DURATIONS = {
  FRICTION:      30 * 60 * 1000,      // 30 minutes
  SHADOW:        2 * 60 * 60 * 1000,  // 2 hours
  ISOLATE:       6 * 60 * 60 * 1000,  // 6 hours
  HARD_RESTRICT: 24 * 60 * 60 * 1000, // 24 hours
};

// Feature isolation map
const ISOLATION_FEATURES = {
  FRICTION:      { ai_access: true, premium: true, subscription: true, sync: true },
  SHADOW:        { ai_access: true, premium: true, subscription: true, sync: true },
  ISOLATE:       { ai_access: false, premium: false, subscription: true, sync: true },
  HARD_RESTRICT: { ai_access: false, premium: false, subscription: false, sync: false },
};

// Friction settings by intensity
const FRICTION_CONFIG = {
  latency_base_ms: 200,
  latency_max_ms: 3000,
  cooldown_base_ms: 1000,
  cooldown_max_ms: 10000,
};

// Anti-pattern multipliers
const PATTERN_MULTIPLIERS = {
  offline_bypass:        1.5,
  subscription_toggle:   1.8,
  multi_device_spike:    1.4,
  tamper_speed_combo:    2.0,
  repeated_escalation:   1.6,
};

const INTENSITY_DECAY_RATE = 0.05;  // per clean hour
const MAX_INTENSITY = 1.0;
const MIN_INTENSITY = 0.1;

// ── Decision Engine ──

/**
 * Compute adaptive response based on user threat profile.
 *
 * @param {object} params
 * @param {number} params.trust_score
 * @param {number} params.anomaly_score
 * @param {number} params.threat_score
 * @param {string[]} params.anomaly_types - array of anomaly type strings
 * @param {number} params.anomaly_count_24h
 * @param {number} params.offline_hours
 * @returns {{ response_type, intensity, duration_ms, reason, features_affected, friction }}
 */
function computeAdaptiveResponse(params) {
  const {
    trust_score = 1.0,
    anomaly_score = 0.0,
    threat_score = 0,
    anomaly_types = [],
    anomaly_count_24h = 0,
    offline_hours = 0,
  } = params;

  // No threat — no response
  if (threat_score < RESPONSE_THRESHOLDS.FRICTION.min_threat && anomaly_count_24h < 3) {
    return {
      response_type: RESPONSE_TYPES.NONE,
      intensity: 0,
      duration_ms: 0,
      reason: 'clean_profile',
      features_affected: ISOLATION_FEATURES.FRICTION, // full access
      friction: null,
    };
  }

  // Determine response type (highest matching threshold)
  let response_type = RESPONSE_TYPES.FRICTION;
  if (threat_score >= RESPONSE_THRESHOLDS.HARD_RESTRICT.min_threat) {
    response_type = RESPONSE_TYPES.HARD_RESTRICT;
  } else if (threat_score >= RESPONSE_THRESHOLDS.ISOLATE.min_threat) {
    response_type = RESPONSE_TYPES.ISOLATE;
  } else if (threat_score >= RESPONSE_THRESHOLDS.SHADOW.min_threat) {
    response_type = RESPONSE_TYPES.SHADOW;
  }

  // Compute base intensity (0–1) from threat score
  let intensity = Math.min(threat_score / 40, MAX_INTENSITY);

  // Apply anti-pattern multipliers
  const patterns = detectPatterns(anomaly_types, anomaly_count_24h, offline_hours);
  let patternMultiplier = 1.0;
  const patternReasons = [];

  for (const p of patterns) {
    patternMultiplier *= PATTERN_MULTIPLIERS[p] || 1.0;
    patternReasons.push(p);
  }

  intensity = Math.min(intensity * patternMultiplier, MAX_INTENSITY);
  intensity = Math.max(intensity, MIN_INTENSITY);

  // Trust modifier — lower trust = higher intensity
  if (trust_score < 0.4) {
    intensity = Math.min(intensity * 1.3, MAX_INTENSITY);
  } else if (trust_score < 0.6) {
    intensity = Math.min(intensity * 1.1, MAX_INTENSITY);
  }

  // Duration scaled by intensity
  const baseDuration = DEFAULT_DURATIONS[response_type] || DEFAULT_DURATIONS.FRICTION;
  const duration_ms = Math.round(baseDuration * intensity);

  // Friction parameters (only for FRICTION/SHADOW types)
  let friction = null;
  if (response_type === RESPONSE_TYPES.FRICTION || response_type === RESPONSE_TYPES.SHADOW) {
    friction = {
      added_latency_ms: Math.round(
        FRICTION_CONFIG.latency_base_ms + (FRICTION_CONFIG.latency_max_ms - FRICTION_CONFIG.latency_base_ms) * intensity
      ),
      cooldown_ms: Math.round(
        FRICTION_CONFIG.cooldown_base_ms + (FRICTION_CONFIG.cooldown_max_ms - FRICTION_CONFIG.cooldown_base_ms) * intensity
      ),
    };
  }

  // Build reason
  const reason = patternReasons.length > 0
    ? `threat_${threat_score}_patterns_${patternReasons.join('+')}`
    : `threat_${threat_score}`;

  return {
    response_type,
    intensity: Math.round(intensity * 1000) / 1000,
    duration_ms,
    reason,
    features_affected: ISOLATION_FEATURES[response_type],
    friction,
  };
}

// ── Anti-Pattern Detection ──

/**
 * Detect behavioral attack patterns from anomaly types.
 */
function detectPatterns(anomalyTypes, count24h, offlineHours) {
  const patterns = [];
  const typeSet = new Set(anomalyTypes.map(t => String(t).toLowerCase()));

  // Offline bypass: long offline + anomalies
  if (offlineHours > 24 && count24h >= 2) {
    patterns.push('offline_bypass');
  }

  // Subscription toggle abuse
  if (typeSet.has('subscription_abuse') || typeSet.has('subscription_toggle')) {
    patterns.push('subscription_toggle');
  }

  // Multi-device spike
  if (typeSet.has('multi_device') || typeSet.has('device_anomaly')) {
    if (count24h >= 4) patterns.push('multi_device_spike');
  }

  // Tamper + speed combo
  const hasTamper = ['clock_tamper', 'root_detected', 'debug_detected', 'binary_tamper']
    .some(t => typeSet.has(t));
  const hasSpeed = ['velocity_anomaly', 'rapid_requests'].some(t => typeSet.has(t));
  if (hasTamper && hasSpeed) {
    patterns.push('tamper_speed_combo');
  }

  // Repeated escalation (high volume)
  if (count24h >= 10) {
    patterns.push('repeated_escalation');
  }

  return patterns;
}

// ── Persistence Layer ──

/**
 * Store an adaptive response record.
 */
async function createAdaptiveResponse(userId, response) {
  const { data, error } = await supabase
    .from('adaptive_responses')
    .insert({
      user_id: userId,
      response_type: response.response_type,
      intensity: response.intensity,
      duration_ms: response.duration_ms,
      reason: response.reason,
      features_affected: response.features_affected,
      friction: response.friction,
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + response.duration_ms).toISOString(),
      active: true,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[responseEngine] createAdaptiveResponse error:', error.message);
    return null;
  }

  return data?.id || null;
}

/**
 * Get the active response for a user (most recent, still active + not expired).
 */
async function getActiveResponse(userId) {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('adaptive_responses')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .gte('end_time', now)
    .order('start_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[responseEngine] getActiveResponse error:', error.message);
    return null;
  }

  return data;
}

/**
 * Deactivate all expired responses for a user.
 */
async function expireResponses(userId) {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('adaptive_responses')
    .update({ active: false })
    .eq('user_id', userId)
    .eq('active', true)
    .lt('end_time', now);

  if (error) {
    console.error('[responseEngine] expireResponses error:', error.message);
  }
}

/**
 * Deactivate a specific response (admin override).
 */
async function deactivateResponse(responseId) {
  const { error } = await supabase
    .from('adaptive_responses')
    .update({ active: false })
    .eq('id', responseId);

  if (error) {
    console.error('[responseEngine] deactivateResponse error:', error.message);
    return false;
  }
  return true;
}

/**
 * Get response history for a user (last N records).
 */
async function getResponseHistory(userId, limit = 20) {
  const { data, error } = await supabase
    .from('adaptive_responses')
    .select('*')
    .eq('user_id', userId)
    .order('start_time', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[responseEngine] getResponseHistory error:', error.message);
    return [];
  }
  return data || [];
}

// ── Intensity Decay ──

/**
 * Decay active response intensity based on clean hours.
 * If intensity drops below MIN_INTENSITY, deactivate the response.
 */
async function decayResponseIntensity(userId, cleanHours) {
  const active = await getActiveResponse(userId);
  if (!active) return { decayed: false, reason: 'no_active_response' };

  const decayAmount = INTENSITY_DECAY_RATE * cleanHours;
  const newIntensity = Math.max(active.intensity - decayAmount, 0);

  if (newIntensity < MIN_INTENSITY) {
    // Intensity too low — deactivate
    await deactivateResponse(active.id);
    return {
      decayed: true,
      deactivated: true,
      previous_intensity: active.intensity,
      new_intensity: 0,
      response_id: active.id,
    };
  }

  const { error } = await supabase
    .from('adaptive_responses')
    .update({ intensity: Math.round(newIntensity * 1000) / 1000 })
    .eq('id', active.id);

  if (error) {
    console.error('[responseEngine] decayResponseIntensity error:', error.message);
    return { decayed: false, reason: error.message };
  }

  return {
    decayed: true,
    deactivated: false,
    previous_intensity: active.intensity,
    new_intensity: Math.round(newIntensity * 1000) / 1000,
    response_id: active.id,
  };
}

// ── Full Evaluation Pipeline ──

/**
 * Full adaptive response evaluation for a user.
 * Queries threat data → computes response → persists if new → returns active response.
 */
async function evaluateAndApply(userId) {
  // 1. Expire stale responses
  await expireResponses(userId);

  // 2. Check if there's already an active response
  const existing = await getActiveResponse(userId);
  if (existing) {
    return {
      action: 'existing',
      response: existing,
    };
  }

  // 3. Gather threat data
  const [userResult, anomalyResult, threatResult] = await Promise.all([
    supabase.from('users').select('trust_score, anomaly_score').eq('id', userId).maybeSingle(),
    supabase.from('anomalies').select('anomaly_type').eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    computeThreatScoreFromDB(userId),
  ]);

  const user = userResult.data;
  if (!user) return { action: 'skip', reason: 'user_not_found' };

  const anomalyTypes = (anomalyResult.data || []).map(a => a.anomaly_type);
  const anomalyCount24h = anomalyTypes.length;

  // Get offline hours from devices
  const { data: device } = await supabase
    .from('devices')
    .select('last_seen')
    .eq('user_id', userId)
    .order('last_seen', { ascending: false })
    .limit(1)
    .maybeSingle();

  const offlineHours = device?.last_seen
    ? Math.max(0, (Date.now() - new Date(device.last_seen).getTime()) / 3600000)
    : 0;

  // 4. Compute adaptive response
  const response = computeAdaptiveResponse({
    trust_score: Number(user.trust_score) || 1.0,
    anomaly_score: Number(user.anomaly_score) || 0,
    threat_score: threatResult.score || 0,
    anomaly_types: anomalyTypes,
    anomaly_count_24h: anomalyCount24h,
    offline_hours: offlineHours,
  });

  // 5. If no action needed, skip persistence
  if (response.response_type === RESPONSE_TYPES.NONE) {
    return { action: 'none', response };
  }

  // 6. Persist the response
  const responseId = await createAdaptiveResponse(userId, response);

  return {
    action: 'created',
    response_id: responseId,
    response,
  };
}

/**
 * Compute threat score from DB (simplified inline version).
 * Uses anomaly counts by type with weighted scoring.
 */
async function computeThreatScoreFromDB(userId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('anomalies')
    .select('anomaly_type, severity')
    .eq('user_id', userId)
    .gte('created_at', since);

  if (error || !data) return { score: 0 };

  const WEIGHTS = {
    clock_tamper: 2.5, root_detected: 2.5, debug_detected: 2.5, binary_tamper: 2.5,
    subscription_abuse: 2.0, subscription_toggle: 2.0,
    offline_abuse: 1.8,
    velocity_anomaly: 1.2, rapid_requests: 1.2,
    device_anomaly: 1.0, network_anomaly: 1.0, multi_device: 1.0,
    version_downgrade: 0.8,
  };

  let score = 0;
  for (const row of data) {
    const w = WEIGHTS[row.anomaly_type] || 1.0;
    const sev = Number(row.severity) || 0.5;
    score += w * (1 + sev);
  }

  return { score: Math.round(score * 100) / 100 };
}

// ── Request-Level Hook ──

/**
 * Apply active response effects to a request.
 * Call this in middleware after trustCheck to modify req behavior.
 *
 * @param {object} req - Express request (with req.user, req.effectiveTrust)
 * @returns {{ applied: boolean, response_type: string, friction: object|null, features: object|null }}
 */
async function applyResponseToRequest(userId) {
  const active = await getActiveResponse(userId);

  if (!active) {
    return { applied: false, response_type: 'NONE', friction: null, features: null };
  }

  return {
    applied: true,
    response_type: active.response_type,
    intensity: active.intensity,
    friction: active.friction,
    features: active.features_affected,
    response_id: active.id,
    expires_at: active.end_time,
  };
}

// ── Admin Controls ──

/**
 * Deactivate all active responses for a user (admin override).
 */
async function clearAllResponses(userId) {
  const { error, count } = await supabase
    .from('adaptive_responses')
    .update({ active: false })
    .eq('user_id', userId)
    .eq('active', true);

  if (error) {
    console.error('[responseEngine] clearAllResponses error:', error.message);
    return { success: false, error: error.message };
  }
  return { success: true, cleared: count || 0 };
}

/**
 * Get summary of response system state for a user.
 */
async function getResponseSummary(userId) {
  const [active, history] = await Promise.all([
    getActiveResponse(userId),
    getResponseHistory(userId, 10),
  ]);

  const totalResponses = history.length;
  const typeCounts = {};
  for (const r of history) {
    typeCounts[r.response_type] = (typeCounts[r.response_type] || 0) + 1;
  }

  return {
    active_response: active || null,
    history_count: totalResponses,
    type_distribution: typeCounts,
    recent_history: history.slice(0, 5),
  };
}

// ── Exports ──

module.exports = {
  // Constants
  RESPONSE_TYPES,
  RESPONSE_THRESHOLDS,
  DEFAULT_DURATIONS,
  ISOLATION_FEATURES,
  FRICTION_CONFIG,
  PATTERN_MULTIPLIERS,

  // Core logic
  computeAdaptiveResponse,
  detectPatterns,

  // Persistence
  createAdaptiveResponse,
  getActiveResponse,
  expireResponses,
  deactivateResponse,
  getResponseHistory,

  // Decay
  decayResponseIntensity,

  // Pipeline
  evaluateAndApply,
  applyResponseToRequest,

  // Admin
  clearAllResponses,
  getResponseSummary,
};
