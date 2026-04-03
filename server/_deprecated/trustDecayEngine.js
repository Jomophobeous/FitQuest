/**
 * Trust Decay Engine — Phase 27.1
 *
 * Pattern-based alerting: single anomaly = noise, pattern = threat.
 * Multi-vector threat scoring with type-specific weights.
 * Count-based threshold model for severity classification.
 * Deduplicates alerts: max 1 open alert per user per type per 10 minutes.
 *
 * Anomaly severity bands (by numeric severity from anomalyEngine):
 *   minor:    severity < 0.3   (e.g. version_downgrade)
 *   moderate: 0.3 ≤ sev < 0.4  (e.g. device_switching, ip_anomaly)
 *   severe:   severity ≥ 0.4   (e.g. subscription_abuse)
 *
 * Threat scoring: weighted sum across anomaly types
 *   tamper signals × 2.5, subscription abuse × 2.0,
 *   offline abuse × 1.8, speed anomalies × 1.2, default × 1.0
 *
 * Exports:
 *   checkThresholdsAndAlert(userId, deviceId, effectiveTrust, anomalyScore)
 *   countAnomaliesByBand(userId)
 *   computeThreatScore(userId)
 *   classifySeverity(numericSeverity)
 *   getSeverityFromCount(count)
 *   getSeverityFromThreatScore(score)
 *   ALERT_THRESHOLDS  — configurable count thresholds
 *   TRUST_THRESHOLDS  — degraded/softBlock score thresholds
 *   THREAT_WEIGHTS    — anomaly type weight multipliers
 *   deriveSeverity(alertType)
 */
'use strict';

const supabase = require('../utils/supabaseClient');
const logEvent = require('../utils/logEvent');

// ── Anomaly severity bands ──

const SEVERITY_BANDS = {
  minor:    { min: 0,   max: 0.299 },
  moderate: { min: 0.3, max: 0.399 },
  severe:   { min: 0.4, max: 1.0 },
};

// ── Count-based alert thresholds (minimum anomaly count to trigger severity) ──

const ALERT_COUNT_THRESHOLDS = {
  LOW:      3,
  MEDIUM:   6,
  HIGH:     10,
  CRITICAL: 15,
};

// ── Threat score thresholds (weighted composite score) ──

const THREAT_SCORE_THRESHOLDS = {
  LOW:      5,
  MEDIUM:   12,
  HIGH:     20,
  CRITICAL: 30,
};

// ── Legacy band-count thresholds (still used for trigger detection) ──

const ALERT_THRESHOLDS = {
  minor_count_24h:    5,
  moderate_count_24h: 3,
  severe_count_24h:   2,
};

// ── Trust score thresholds ──

const TRUST_THRESHOLDS = {
  degraded:  0.6,  // < 0.6 → degraded mode
  softBlock: 0.3,  // < 0.3 → soft block + admin alert
};

// ── Multi-vector threat weights by anomaly type ──

const THREAT_WEIGHTS = {
  // Tamper signals — highest weight
  clock_manipulation:    2.5,
  root_detection:        2.5,
  debug_detection:       2.5,
  binary_tampering:      2.5,
  // Subscription abuse
  subscription_abuse:    2.0,
  receipt_replay:        2.0,
  entitlement_mismatch:  2.0,
  // Offline abuse
  offline_abuse:         1.8,
  extended_offline:      1.8,
  // Speed / velocity anomalies
  velocity_anomaly:      1.2,
  rapid_requests:        1.2,
  // Device / network signals
  device_switching:      1.0,
  ip_anomaly:            1.0,
  geo_anomaly:           1.0,
  // Low-signal events
  version_downgrade:     0.8,
};

const DEFAULT_THREAT_WEIGHT = 1.0;

// ── Alert dedup window: 10 minutes (ms) ──
const ALERT_DEDUP_WINDOW_MS = 10 * 60 * 1000;

// ── Alert type → severity mapping ──

const ALERT_TYPE_SEVERITY = {
  trust_soft_block:               'CRITICAL',
  ANOMALY_THRESHOLD_EXCEEDED:     'MEDIUM', // overridden by count/score
  severe_anomaly_threshold:       'HIGH',
  trust_degraded:                 'HIGH',
  moderate_anomaly_threshold:     'MEDIUM',
  minor_anomaly_threshold:        'LOW',
  threshold_breach:               'MEDIUM',
};

/**
 * Classify a numeric severity (0..1) into a band name.
 */
function classifySeverity(numericSeverity) {
  const s = Number(numericSeverity) || 0;
  if (s >= SEVERITY_BANDS.severe.min) return 'severe';
  if (s >= SEVERITY_BANDS.moderate.min) return 'moderate';
  return 'minor';
}

/**
 * Derive an alert severity label from alert_type.
 */
function deriveSeverity(alertType) {
  return ALERT_TYPE_SEVERITY[alertType] || 'MEDIUM';
}

/**
 * Determine severity from raw anomaly count (pattern threshold model).
 * Returns null if count is below minimum threshold.
 */
function getSeverityFromCount(count) {
  if (count >= ALERT_COUNT_THRESHOLDS.CRITICAL) return 'CRITICAL';
  if (count >= ALERT_COUNT_THRESHOLDS.HIGH)     return 'HIGH';
  if (count >= ALERT_COUNT_THRESHOLDS.MEDIUM)   return 'MEDIUM';
  if (count >= ALERT_COUNT_THRESHOLDS.LOW)      return 'LOW';
  return null;
}

/**
 * Determine severity from weighted threat score (multi-vector model).
 * Returns null if score is below minimum threshold.
 */
function getSeverityFromThreatScore(score) {
  if (score >= THREAT_SCORE_THRESHOLDS.CRITICAL) return 'CRITICAL';
  if (score >= THREAT_SCORE_THRESHOLDS.HIGH)     return 'HIGH';
  if (score >= THREAT_SCORE_THRESHOLDS.MEDIUM)   return 'MEDIUM';
  if (score >= THREAT_SCORE_THRESHOLDS.LOW)      return 'LOW';
  return null;
}

/**
 * Count anomalies in the last 24h, classified by severity band.
 * Returns { counts: { minor, moderate, severe }, types: { minor, moderate, severe }, total }
 */
async function countAnomaliesByBand(userId) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('anomalies')
    .select('severity, anomaly_type, created_at')
    .eq('user_id', userId)
    .gte('created_at', since24h)
    .order('created_at', { ascending: false })
    .limit(100);

  const counts = { minor: 0, moderate: 0, severe: 0 };
  const types  = { minor: [], moderate: [], severe: [] };

  if (data) {
    for (const a of data) {
      const band = classifySeverity(a.severity);
      counts[band]++;
      if (!types[band].includes(a.anomaly_type)) {
        types[band].push(a.anomaly_type);
      }
    }
  }

  return { counts, types, total: (data || []).length };
}

/**
 * Compute multi-vector weighted threat score from 24h anomaly window.
 * Each anomaly type has a specific weight — tamper signals are weighted
 * much higher than low-signal events like version_downgrade.
 *
 * Returns { threatScore, breakdown: { [type]: { count, weight, subtotal } }, rawCount }
 */
async function computeThreatScore(userId) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('anomalies')
    .select('anomaly_type, severity')
    .eq('user_id', userId)
    .gte('created_at', since24h)
    .order('created_at', { ascending: false })
    .limit(100);

  const breakdown = {};
  let threatScore = 0;

  if (data) {
    for (const a of data) {
      const type = a.anomaly_type || 'unknown';
      const weight = THREAT_WEIGHTS[type] || DEFAULT_THREAT_WEIGHT;

      if (!breakdown[type]) {
        breakdown[type] = { count: 0, weight, subtotal: 0 };
      }
      breakdown[type].count++;
      breakdown[type].subtotal += weight;
      threatScore += weight;
    }
  }

  return {
    threatScore: Math.round(threatScore * 100) / 100,
    breakdown,
    rawCount: (data || []).length,
  };
}

/**
 * Check thresholds and create trust_alerts if pattern-level threat detected.
 * Called after anomaly detection + score update.
 *
 * Core principle: single anomaly = noise, pattern = threat.
 *
 * Two detection paths (highest severity wins):
 *   1. Multi-vector threat score (weighted by anomaly type)
 *   2. Raw count threshold (fallback)
 *   3. Trust-level triggers (soft_block, degraded) — but only with evidence
 *
 * Returns { alerted: boolean, alertType?, severity?, threatScore?, reason? }
 */
async function checkThresholdsAndAlert(userId, deviceId, effectiveTrust, anomalyScore) {
  try {
    const { counts, types, total } = await countAnomaliesByBand(userId);
    const { threatScore, breakdown, rawCount } = await computeThreatScore(userId);

    // ── Severity from two models (highest wins) ──
    const countSeverity = getSeverityFromCount(rawCount);
    const scoreSeverity = getSeverityFromThreatScore(threatScore);

    const SEVERITY_RANK = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    const rank = (s) => SEVERITY_RANK[s] || 0;

    let alertSeverity = null;
    let detectionMethod = null;

    if (scoreSeverity && (!countSeverity || rank(scoreSeverity) >= rank(countSeverity))) {
      alertSeverity = scoreSeverity;
      detectionMethod = 'threat_score';
    } else if (countSeverity) {
      alertSeverity = countSeverity;
      detectionMethod = 'count_threshold';
    }

    // ── Trust-level triggers require evidence (at least 1 anomaly) ──
    let alertType = null;

    if (effectiveTrust < TRUST_THRESHOLDS.softBlock && rawCount >= 1) {
      alertType = 'trust_soft_block';
      alertSeverity = 'CRITICAL';
      detectionMethod = detectionMethod || 'trust_level';
    } else if (effectiveTrust < TRUST_THRESHOLDS.degraded && rawCount >= 1) {
      if (!alertSeverity || rank(alertSeverity) < rank('HIGH')) {
        alertType = 'trust_degraded';
        alertSeverity = alertSeverity || 'HIGH';
        detectionMethod = detectionMethod || 'trust_level';
      }
    }

    // If pattern threshold triggered, use unified alert type
    if (!alertType && alertSeverity) {
      alertType = 'ANOMALY_THRESHOLD_EXCEEDED';
    }

    // No pattern detected — noise, not threat
    if (!alertType || !alertSeverity) {
      return { alerted: false, threatScore, rawCount };
    }

    // ── Dedup: check for open alert of same type within 10-minute window ──
    const dedupSince = new Date(Date.now() - ALERT_DEDUP_WINDOW_MS).toISOString();
    const { count: existingCount } = await supabase
      .from('trust_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('alert_type', alertType)
      .eq('status', 'OPEN')
      .gte('created_at', dedupSince);

    if ((existingCount || 0) > 0) {
      return { alerted: false, reason: 'dedup', threatScore, rawCount };
    }

    // ── Insert alert ──
    const alertRecord = {
      user_id:              userId,
      device_id:            deviceId || null,
      trust_score:          Math.round(effectiveTrust * 1000) / 1000,
      trust_score_at_alert: Math.round(effectiveTrust * 1000) / 1000,
      anomaly_count:        rawCount,
      alert_type:           alertType,
      severity:             alertSeverity,
      status:               'OPEN',
      anomaly_summary:      { bands: counts, breakdown, threatScore },
      metadata:             { detectionMethod, rawCount, threatScore },
      resolved:             false,
    };

    const { error } = await supabase.from('trust_alerts').insert(alertRecord);
    if (error) {
      console.error('[trustDecay] Alert insert error:', error.message);
      return { alerted: false, error: error.message };
    }

    // Log event
    logEvent(userId, deviceId, 'trust_alert_created', null, {
      alert_type:       alertType,
      severity:         alertSeverity,
      detection_method: detectionMethod,
      effective_trust:  effectiveTrust,
      threat_score:     threatScore,
      anomaly_count:    rawCount,
      anomaly_bands:    counts,
    });

    return {
      alerted: true,
      alertType,
      severity: alertSeverity,
      threatScore,
      detectionMethod,
      rawCount,
    };
  } catch (err) {
    // Silent — alerting must never break request flow
    console.error('[trustDecay] checkThresholdsAndAlert error:', err.message);
    return { alerted: false, error: err.message };
  }
}

module.exports = {
  checkThresholdsAndAlert,
  countAnomaliesByBand,
  computeThreatScore,
  classifySeverity,
  getSeverityFromCount,
  getSeverityFromThreatScore,
  ALERT_THRESHOLDS,
  ALERT_COUNT_THRESHOLDS,
  THREAT_SCORE_THRESHOLDS,
  THREAT_WEIGHTS,
  TRUST_THRESHOLDS,
  SEVERITY_BANDS,
  ALERT_TYPE_SEVERITY,
};
