/**
 * Trust Decay Engine — Phase 27
 *
 * Configurable threshold-based alerting and trust decay.
 * Counts anomalies by severity band in 24h windows.
 * Generates trust_alerts when thresholds are breached.
 * Deduplicates alerts: max 1 open alert per user per type per hour.
 *
 * Anomaly severity bands (by numeric severity from anomalyEngine):
 *   minor:    severity < 0.3   (e.g. version_downgrade)
 *   moderate: 0.3 ≤ sev < 0.4  (e.g. device_switching, ip_anomaly)
 *   severe:   severity ≥ 0.4   (e.g. subscription_abuse)
 *
 * Exports:
 *   checkThresholdsAndAlert(userId, deviceId, effectiveTrust, anomalyScore)
 *   countAnomaliesByBand(userId)
 *   classifySeverity(numericSeverity)
 *   ALERT_THRESHOLDS  — configurable count thresholds
 *   TRUST_THRESHOLDS  — degraded/softBlock score thresholds
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

// ── Configurable thresholds: count in 24h window that triggers alert ──

const ALERT_THRESHOLDS = {
  minor_count_24h:    5,
  moderate_count_24h: 3,
  severe_count_24h:   1,
};

// ── Trust score thresholds ──

const TRUST_THRESHOLDS = {
  degraded:  0.6,  // < 0.6 → degraded mode
  softBlock: 0.3,  // < 0.3 → soft block + admin alert
};

// ── Alert dedup window: 1 hour (ms) ──
const ALERT_DEDUP_WINDOW_MS = 60 * 60 * 1000;

// ── Alert type → severity mapping ──

const ALERT_TYPE_SEVERITY = {
  trust_soft_block:           'CRITICAL',
  severe_anomaly_threshold:   'HIGH',
  trust_degraded:             'HIGH',
  moderate_anomaly_threshold: 'MEDIUM',
  minor_anomaly_threshold:    'LOW',
  threshold_breach:           'MEDIUM',
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
 * Check thresholds and create trust_alerts if breached.
 * Called after anomaly detection + score update.
 *
 * Returns { alerted: boolean, alertType?, reason? }
 */
async function checkThresholdsAndAlert(userId, deviceId, effectiveTrust, anomalyScore) {
  try {
    const { counts, types, total } = await countAnomaliesByBand(userId);

    // ── Determine triggers ──
    const triggers = [];

    if (counts.severe >= ALERT_THRESHOLDS.severe_count_24h) {
      triggers.push({ reason: 'severe_threshold', band: 'severe', count: counts.severe });
    }
    if (counts.moderate >= ALERT_THRESHOLDS.moderate_count_24h) {
      triggers.push({ reason: 'moderate_threshold', band: 'moderate', count: counts.moderate });
    }
    if (counts.minor >= ALERT_THRESHOLDS.minor_count_24h) {
      triggers.push({ reason: 'minor_threshold', band: 'minor', count: counts.minor });
    }

    // Trust level triggers
    if (effectiveTrust < TRUST_THRESHOLDS.softBlock) {
      triggers.push({ reason: 'trust_soft_block', trust: effectiveTrust });
    } else if (effectiveTrust < TRUST_THRESHOLDS.degraded) {
      triggers.push({ reason: 'trust_degraded', trust: effectiveTrust });
    }

    if (triggers.length === 0) return { alerted: false };

    // ── Pick worst alert type ──
    let alertType = 'threshold_breach';

    if (triggers.some(t => t.reason === 'trust_soft_block')) {
      alertType = 'trust_soft_block';
    } else if (triggers.some(t => t.reason === 'severe_threshold')) {
      alertType = 'severe_anomaly_threshold';
    } else if (triggers.some(t => t.reason === 'trust_degraded')) {
      alertType = 'trust_degraded';
    } else if (triggers.some(t => t.reason === 'moderate_threshold')) {
      alertType = 'moderate_anomaly_threshold';
    } else {
      alertType = 'minor_anomaly_threshold';
    }

    // ── Dedup: check for open alert of same type within window ──
    const dedupSince = new Date(Date.now() - ALERT_DEDUP_WINDOW_MS).toISOString();
    const { count: existingCount } = await supabase
      .from('trust_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('alert_type', alertType)
      .eq('resolved', false)
      .gte('created_at', dedupSince);

    if ((existingCount || 0) > 0) {
      return { alerted: false, reason: 'dedup' };
    }

    // ── Insert alert ──
    // Uses existing table columns: user_id, device_id, trust_score, anomaly_count, alert_type, resolved
    const alertRecord = {
      user_id:       userId,
      device_id:     deviceId || null,
      trust_score:   Math.round(effectiveTrust * 1000) / 1000,
      anomaly_count: total,
      alert_type:    alertType,
      resolved:      false,
    };

    const { error } = await supabase.from('trust_alerts').insert(alertRecord);
    if (error) {
      console.error('[trustDecay] Alert insert error:', error.message);
      return { alerted: false, error: error.message };
    }

    // Log high-severity event
    logEvent(userId, deviceId, 'trust_alert_created', null, {
      alert_type:      alertType,
      severity:        deriveSeverity(alertType),
      effective_trust: effectiveTrust,
      anomaly_count:   total,
      anomaly_bands:   counts,
      triggers,
    });

    return { alerted: true, alertType, severity: deriveSeverity(alertType) };
  } catch (err) {
    // Silent — alerting must never break request flow
    console.error('[trustDecay] checkThresholdsAndAlert error:', err.message);
    return { alerted: false, error: err.message };
  }
}

module.exports = {
  checkThresholdsAndAlert,
  countAnomaliesByBand,
  classifySeverity,
  deriveSeverity,
  ALERT_THRESHOLDS,
  TRUST_THRESHOLDS,
  SEVERITY_BANDS,
  ALERT_TYPE_SEVERITY,
};
