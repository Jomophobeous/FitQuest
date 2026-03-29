/**
 * FitQuest Anomaly Detection Engine — Phase 22.2
 *
 * Real-time behavioral anomaly detection with persistent scoring.
 * Converts raw telemetry into anomaly records, updates trust scores,
 * and feeds enforcement decisions.
 *
 * Exports:
 *   evaluateUserActivity(user_id, device_id, context)
 *   applyAnomaly(user_id, device_id, type, severity, metadata)
 *   updateScores(user_id, device_id)
 *   computeEffectiveScore(user_id, device_id)
 *
 * Detection rules:
 *   A. Device switching  — >3 devices in 10 min      → severity 0.30
 *   B. Subscription abuse — >5 failures in 15 min     → severity 0.40
 *   C. Version downgrade  — current < previous        → severity 0.25
 *   D. AI abuse           — >20 req/5min OR avg>2000  → severity 0.35
 *   E. IP anomaly         — >5 IPs in 10 min          → severity 0.30
 *
 * Scoring: decay-weighted sum of last 20 anomalies
 *   anomaly_score = MIN(1.0, SUM(severity * exp(-age_hours / 24)))
 *
 * Phase 22.2 additions:
 *   - Deduplication: same type + window → no duplicate insert
 *   - computeEffectiveScore: trust_score - anomaly_score
 *   - Enriched metadata: rule_triggered, timestamp, count, window
 *   - anomaly_score never exposed to client
 */
'use strict';

const supabase = require('../utils/supabaseClient');
const logEvent = require('../utils/logEvent');

// ── Deduplication: prevent same anomaly type within this window (minutes) ──
const DEDUP_WINDOW_MINUTES = 5;

// ── Detection thresholds ──

const THRESHOLDS = {
  maxDevicesPer10Min: 3,
  maxFailedVerifications15Min: 5,
  maxAIRequestsPer5Min: 20,
  maxAvgPromptLength: 2000,
  maxIPsPer10Min: 5,
};

const SEVERITIES = {
  device_switching: 0.30,
  subscription_abuse: 0.40,
  version_downgrade: 0.25,
  ai_abuse: 0.35,
  ip_anomaly: 0.30,
};

// ── Detection Functions ──

/**
 * A. Device switching — >3 distinct devices in 10 minutes
 */
async function detectDeviceSwitching(userId, since10Min) {
  const { data } = await supabase
    .from('events')
    .select('device_id')
    .eq('user_id', userId)
    .gte('timestamp', since10Min)
    .not('device_id', 'is', null);

  if (!data || data.length === 0) return null;
  const distinctDevices = new Set(data.map(r => r.device_id)).size;
  if (distinctDevices > THRESHOLDS.maxDevicesPer10Min) {
    return { type: 'device_switching', trigger_value: distinctDevices, threshold: THRESHOLDS.maxDevicesPer10Min };
  }
  return null;
}

/**
 * B. Subscription verification abuse — >5 failures in 15 minutes
 */
async function detectSubscriptionAbuse(userId, since15Min) {
  const failureTypes = ['subscription_failed', 'unknown_device', 'device_user_mismatch', 'access_suspended'];
  const { count } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('timestamp', since15Min)
    .in('event_type', failureTypes);

  const total = count || 0;
  if (total > THRESHOLDS.maxFailedVerifications15Min) {
    return { type: 'subscription_abuse', trigger_value: total, threshold: THRESHOLDS.maxFailedVerifications15Min };
  }
  return null;
}

/**
 * C. Version downgrade — current version < previous version
 */
function detectVersionDowngrade(context) {
  if (!context.app_version || !context.previous_version) return null;
  if (context.app_version < context.previous_version) {
    return { type: 'version_downgrade', trigger_value: context.app_version, threshold: context.previous_version };
  }
  return null;
}

/**
 * D. AI abuse — >20 requests in 5 min OR avg prompt_length > 2000
 */
async function detectAIAbuse(userId, since5Min) {
  const { data } = await supabase
    .from('ai_usage')
    .select('prompt_length')
    .eq('user_id', userId)
    .gte('timestamp', since5Min);

  if (!data || data.length === 0) return null;

  const requestCount = data.length;
  const avgPromptLength = Math.round(data.reduce((s, r) => s + (r.prompt_length || 0), 0) / data.length);

  if (requestCount > THRESHOLDS.maxAIRequestsPer5Min) {
    return { type: 'ai_abuse', trigger_value: requestCount, threshold: THRESHOLDS.maxAIRequestsPer5Min, reason: 'request_volume' };
  }
  if (avgPromptLength > THRESHOLDS.maxAvgPromptLength) {
    return { type: 'ai_abuse', trigger_value: avgPromptLength, threshold: THRESHOLDS.maxAvgPromptLength, reason: 'prompt_length' };
  }
  return null;
}

/**
 * E. IP anomaly — >5 distinct IPs in 10 minutes
 */
async function detectIPAnomaly(userId, since10Min) {
  const { data } = await supabase
    .from('events')
    .select('ip')
    .eq('user_id', userId)
    .gte('timestamp', since10Min)
    .not('ip', 'is', null);

  if (!data || data.length === 0) return null;
  const distinctIPs = new Set(data.map(r => r.ip)).size;
  if (distinctIPs > THRESHOLDS.maxIPsPer10Min) {
    return { type: 'ip_anomaly', trigger_value: distinctIPs, threshold: THRESHOLDS.maxIPsPer10Min };
  }
  return null;
}

// ── Core Public API ──

/**
 * Insert an anomaly record + log the event.
 * Idempotent: skips insert if same anomaly_type exists within DEDUP_WINDOW_MINUTES.
 */
async function applyAnomaly(userId, deviceId, type, severity, meta) {
  try {
    // Dedup check — prevent duplicate anomalies for same type within window
    const dedupSince = new Date(Date.now() - DEDUP_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count: existing } = await supabase
      .from('anomalies')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('anomaly_type', type)
      .gte('created_at', dedupSince);

    if ((existing || 0) > 0) return; // Already recorded in this window

    // Enriched metadata per Phase 22.2 spec
    const enrichedMeta = {
      rule_triggered: type,
      trigger_value: meta?.trigger_value,
      threshold: meta?.threshold,
      count: meta?.trigger_value,
      window: meta?.reason || `${DEDUP_WINDOW_MINUTES}min`,
      timestamp: new Date().toISOString(),
      ...(meta || {}),
    };

    await supabase.from('anomalies').insert({
      user_id: userId,
      device_id: deviceId || null,
      anomaly_type: type,
      severity,
      metadata: enrichedMeta,
    });

    logEvent(userId, deviceId, 'anomaly_detected', null, enrichedMeta);
  } catch (_e) {
    // Silent — anomaly logging must never break request flow
  }
}

/**
 * Recompute anomaly_score from the last 20 anomalies (decay-weighted).
 * Writes updated score to users + devices tables.
 * Returns the new user-level anomaly_score.
 */
async function updateScores(userId, deviceId) {
  try {
    // Fetch last 20 anomalies for this user
    const { data: anomalies } = await supabase
      .from('anomalies')
      .select('severity, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    let score = 0;
    if (anomalies && anomalies.length > 0) {
      const now = Date.now();
      for (const a of anomalies) {
        const ageHours = (now - new Date(a.created_at).getTime()) / (1000 * 60 * 60);
        const decay = Math.exp(-ageHours / 24);
        score += (Number(a.severity) || 0) * decay;
      }
      score = Math.min(1.0, score);
    }
    score = Math.round(score * 1000) / 1000;

    // Update user anomaly_score (graceful if column missing)
    const { error: userErr } = await supabase
      .from('users')
      .update({ anomaly_score: score })
      .eq('id', userId);
    if (userErr && !userErr.message?.includes('anomaly_score')) {
      console.error('[anomalyEngine] users update error:', userErr.message);
    }

    // Update device anomaly_score (device-specific anomalies only)
    if (deviceId) {
      const { data: deviceAnomalies } = await supabase
        .from('anomalies')
        .select('severity, created_at')
        .eq('user_id', userId)
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false })
        .limit(20);

      let deviceScore = 0;
      if (deviceAnomalies && deviceAnomalies.length > 0) {
        const now2 = Date.now();
        for (const a of deviceAnomalies) {
          const ageHours = (now2 - new Date(a.created_at).getTime()) / (1000 * 60 * 60);
          const decay = Math.exp(-ageHours / 24);
          deviceScore += (Number(a.severity) || 0) * decay;
        }
        deviceScore = Math.min(1.0, deviceScore);
      }
      deviceScore = Math.round(deviceScore * 1000) / 1000;

      const { error: devErr } = await supabase
        .from('devices')
        .update({ anomaly_score: deviceScore })
        .eq('device_id', deviceId);
      if (devErr && !devErr.message?.includes('anomaly_score')) {
        console.error('[anomalyEngine] devices update error:', devErr.message);
      }
    }

    return score;
  } catch (_e) {
    return 0;
  }
}

/**
 * Run all detection rules against current user activity.
 * If any rule triggers, applies the anomaly and updates scores.
 *
 * context: { ip, app_version, previous_version, event_type, prompt_length }
 *
 * Returns { triggered: [...], anomalyScore }
 */
async function evaluateUserActivity(userId, deviceId, context = {}) {
  const now = new Date();
  const since10Min = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const since15Min = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const since5Min  = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

  // Run all async detections in parallel
  const [deviceSwitch, subAbuse, aiAbuse, ipAnomaly] = await Promise.all([
    detectDeviceSwitching(userId, since10Min),
    detectSubscriptionAbuse(userId, since15Min),
    detectAIAbuse(userId, since5Min),
    detectIPAnomaly(userId, since10Min),
  ]);

  // Version downgrade is synchronous (from context)
  const versionDown = detectVersionDowngrade(context);

  const results = [deviceSwitch, subAbuse, versionDown, aiAbuse, ipAnomaly].filter(Boolean);

  // Apply each triggered anomaly
  for (const r of results) {
    const severity = SEVERITIES[r.type] || 0.2;
    await applyAnomaly(userId, deviceId, r.type, severity, r);
  }

  // Recompute scores only if something triggered (avoids unnecessary DB round-trips)
  let anomalyScore = 0;
  if (results.length > 0) {
    anomalyScore = await updateScores(userId, deviceId);
  }
  // When nothing triggers, return 0 — trustCheck already reads DB-persisted scores

  return {
    triggered: results.map(r => r.type),
    anomalyScore,
  };
}

/**
 * Compute effective trust score: trust_score - anomaly_score.
 * Reads DB-persisted scores. Returns { effectiveScore, trustScore, anomalyScore }.
 */
async function computeEffectiveScore(userId, deviceId) {
  try {
    let userTrust = 1.0;
    let userAnomaly = 0;
    let deviceAnomaly = 0;

    const { data: user } = await supabase
      .from('users')
      .select('trust_score, anomaly_score')
      .eq('id', userId)
      .maybeSingle();

    if (user) {
      userTrust = Number(user.trust_score) || 1.0;
      userAnomaly = Number(user.anomaly_score) || 0;
    }

    if (deviceId) {
      const { data: device } = await supabase
        .from('devices')
        .select('trust_score, anomaly_score')
        .eq('device_id', deviceId)
        .maybeSingle();

      if (device) {
        deviceAnomaly = Number(device.anomaly_score) || 0;
      }
    }

    const anomalyScore = Math.max(userAnomaly, deviceAnomaly);
    const effectiveScore = Math.max(0, Math.min(1.0, userTrust - anomalyScore));

    return {
      effectiveScore: Math.round(effectiveScore * 1000) / 1000,
      trustScore: userTrust,
      anomalyScore: Math.round(anomalyScore * 1000) / 1000,
    };
  } catch (_e) {
    return { effectiveScore: 1.0, trustScore: 1.0, anomalyScore: 0 };
  }
}

module.exports = { evaluateUserActivity, applyAnomaly, updateScores, computeEffectiveScore, THRESHOLDS, SEVERITIES };
