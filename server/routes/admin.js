/**
 * Admin API Routes — Phase 28 (Enforcement Layer)
 *
 * Dashboard hooks for trust management:
 *   POST /admin/trust-scores   — List users with degraded/blocked trust
 *   POST /admin/alerts         — List active trust alerts (filterable)
 *   POST /admin/anomaly-log    — Anomaly timeline for a user
 *   POST /admin/alert/acknowledge — Acknowledge an alert
 *   POST /admin/alert/resolve  — Resolve an alert with notes
 *   POST /admin/alert/escalate — Escalate alert to CRITICAL
 *   POST /admin/trust-reset    — Reset a user's trust + anomaly scores
 *   POST /admin/trust-override — Clear soft-block for a user
 *   POST /admin/set-scores     — Directly set trust/anomaly scores
 *   POST /admin/inject-anomaly — Insert anomaly record (admin use)
 *   POST /admin/check-thresholds — Trigger threshold check + alerting
 *   POST /admin/config         — Return current threshold config
 *   POST /admin/enforcement-status — Get user's enforcement state (Phase 28)
 *   POST /admin/force-profile  — Override user's access profile (Phase 28)
 *   POST /admin/clear-override — Remove active enforcement override (Phase 28)
 *   POST /admin/revoke-tokens  — Revoke all device tokens (Phase 28)
 *   POST /admin/reinstate-tokens — Reinstate revoked tokens (Phase 28)
 *   POST /admin/trigger-recovery — Apply soft trust recovery (Phase 28)
 *
 * Auth: Requires API_KEY (global middleware) + ADMIN_SECRET in request body.
 * ADMIN_SECRET defaults to DEVICE_SIGNING_SECRET if not set separately.
 */
'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabaseClient');
const respond = require('../utils/respond');
const logEvent = require('../utils/logEvent');
const { TRUST_THRESHOLDS, ALERT_THRESHOLDS, ALERT_COUNT_THRESHOLDS, THREAT_SCORE_THRESHOLDS, THREAT_WEIGHTS } = require('../engines/trustDecayEngine');
const { computeEffectiveScore } = require('../engines/anomalyEngine');
const {
  TRUST_BANDS,
  ACCESS_PROFILES,
  getAccessProfile,
  getEnforcementState,
  getOverrideStatus,
  forceProfile,
  clearOverride,
  revokeAllTokens,
  reinstateTokens,
  applySoftRecovery,
  bridgeAlertToEnforcement,
  getFeatureGate,
  applyAdaptivePenalty,
} = require('../engines/enforcementEngine');
const {
  getReputationSummary,
  applyReputationRecovery,
  resolveAsFalsePositive,
  isShadowModeEnabled,
  setShadowMode,
  applyTrustFloor,
  decayReputation,
  SEVERITY_DELAYS,
  TRUST_FLOOR_RULES,
} = require('../engines/reputationEngine');

// ── Admin auth: constant-time comparison ──
const crypto = require('crypto');
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.DEVICE_SIGNING_SECRET;

function validateAdminSecret(req, res) {
  if (!ADMIN_SECRET) {
    respond(res, 503, null, 'Admin API not configured.');
    return false;
  }
  const { admin_secret } = req.body;
  if (!admin_secret || typeof admin_secret !== 'string') {
    respond(res, 401, null, 'Missing admin_secret.');
    return false;
  }
  if (admin_secret.length !== ADMIN_SECRET.length) {
    respond(res, 401, null, 'Invalid admin_secret.');
    return false;
  }
  const valid = crypto.timingSafeEqual(
    Buffer.from(admin_secret, 'utf8'),
    Buffer.from(ADMIN_SECRET, 'utf8')
  );
  if (!valid) {
    respond(res, 401, null, 'Invalid admin_secret.');
    return false;
  }
  return true;
}

// ── POST /admin/trust-scores ──
// Returns users with effectiveTrust below threshold
router.post('/admin/trust-scores', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { limit = 50 } = req.body;
    const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 200);

    // Fetch users with anomaly_score > 0 (potential trust issues)
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, trust_score, anomaly_score, created_at')
      .gt('anomaly_score', 0)
      .order('anomaly_score', { ascending: false })
      .limit(safeLimit);

    if (error) {
      return respond(res, 500, null, 'Failed to fetch trust scores.');
    }

    // Compute effective scores and classify
    const results = (users || []).map(u => {
      const trustScore = Number(u.trust_score) || 1.0;
      const anomalyScore = Number(u.anomaly_score) || 0;
      const effective = Math.max(0, Math.min(1.0, trustScore - anomalyScore));
      let status = 'full';
      if (effective < TRUST_THRESHOLDS.softBlock) status = 'soft_blocked';
      else if (effective < TRUST_THRESHOLDS.degraded) status = 'degraded';

      return {
        user_id: u.id,
        email: u.email,
        trust_score: trustScore,
        anomaly_score: anomalyScore,
        effective_trust: Math.round(effective * 1000) / 1000,
        status,
        created_at: u.created_at,
      };
    });

    return respond(res, 200, {
      users: results,
      thresholds: TRUST_THRESHOLDS,
      count: results.length,
    });
  } catch (err) {
    console.error('[admin] trust-scores error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /admin/alerts ──
// Returns trust alerts, filterable by status/severity/user
router.post('/admin/alerts', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { status, alert_type, user_id, limit = 50 } = req.body;
    const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 200);

    let query = supabase
      .from('trust_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (status === 'open') query = query.eq('resolved', false);
    else if (status === 'resolved') query = query.eq('resolved', true);

    if (alert_type && typeof alert_type === 'string') {
      query = query.eq('alert_type', alert_type.trim().slice(0, 64));
    }
    if (user_id && typeof user_id === 'string') {
      query = query.eq('user_id', user_id.trim().slice(0, 128));
    }

    const { data, error } = await query;
    if (error) {
      return respond(res, 500, null, 'Failed to fetch alerts.');
    }

    const alerts = (data || []).map(a => ({
      ...a,
      severity: a.severity || 'LOW',
    }));

    return respond(res, 200, {
      alerts,
      count: alerts.length,
    });
  } catch (err) {
    console.error('[admin] alerts error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /admin/anomaly-log ──
// Returns anomaly timeline for a specific user
router.post('/admin/anomaly-log', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { user_id, limit = 50, since_hours = 24 } = req.body;
    if (!user_id || typeof user_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid user_id.');
    }

    const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 200);
    const sinceHours = Math.min(Math.max(1, Number(since_hours) || 24), 720); // max 30 days
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('anomalies')
      .select('id, user_id, device_id, anomaly_type, severity, metadata, created_at')
      .eq('user_id', user_id.trim().slice(0, 128))
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (error) {
      return respond(res, 500, null, 'Failed to fetch anomaly log.');
    }

    // Compute current effective score
    const effective = await computeEffectiveScore(user_id, null);

    return respond(res, 200, {
      user_id,
      effective_trust: effective.effectiveScore,
      trust_score: effective.trustScore,
      anomaly_score: effective.anomalyScore,
      anomalies: data || [],
      count: (data || []).length,
      window_hours: sinceHours,
    });
  } catch (err) {
    console.error('[admin] anomaly-log error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /admin/alert/acknowledge ──
router.post('/admin/alert/acknowledge', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { alert_id } = req.body;
    if (!alert_id || typeof alert_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid alert_id.');
    }

    // Verify alert exists and is open
    const { data: existing } = await supabase
      .from('trust_alerts')
      .select('id, resolved')
      .eq('id', alert_id.trim())
      .maybeSingle();

    if (!existing) {
      return respond(res, 404, null, 'Alert not found.');
    }
    if (existing.resolved) {
      return respond(res, 409, null, 'Alert already resolved.');
    }

    // Note: With limited schema, we just log the acknowledgement as an event
    // (no status column to update, resolved stays false until full resolution)
    logEvent(null, null, 'alert_acknowledged', null, { alert_id });

    return respond(res, 200, { alert_id, acknowledged: true });
  } catch (err) {
    console.error('[admin] alert/acknowledge error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /admin/alert/resolve ──
router.post('/admin/alert/resolve', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { alert_id, notes } = req.body;
    if (!alert_id || typeof alert_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid alert_id.');
    }

    const { data: existing } = await supabase
      .from('trust_alerts')
      .select('id, user_id, resolved')
      .eq('id', alert_id.trim())
      .maybeSingle();

    if (!existing) {
      return respond(res, 404, null, 'Alert not found.');
    }
    if (existing.resolved) {
      return respond(res, 409, null, 'Alert already resolved.');
    }

    const { error } = await supabase
      .from('trust_alerts')
      .update({ resolved: true })
      .eq('id', alert_id.trim());

    if (error) {
      return respond(res, 500, null, 'Failed to resolve alert.');
    }

    logEvent(existing.user_id, null, 'alert_resolved', null, {
      alert_id,
      notes: typeof notes === 'string' ? notes.slice(0, 500) : null,
    });

    return respond(res, 200, { alert_id, resolved: true });
  } catch (err) {
    console.error('[admin] alert/resolve error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /admin/alert/escalate ──
router.post('/admin/alert/escalate', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { alert_id, reason } = req.body;
    if (!alert_id || typeof alert_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid alert_id.');
    }

    const { data: existing } = await supabase
      .from('trust_alerts')
      .select('id, user_id, alert_type, resolved')
      .eq('id', alert_id.trim())
      .maybeSingle();

    if (!existing) {
      return respond(res, 404, null, 'Alert not found.');
    }
    if (existing.resolved) {
      return respond(res, 409, null, 'Alert already resolved.');
    }

    // Escalation: create a new CRITICAL alert referencing the original
    const { error } = await supabase.from('trust_alerts').insert({
      user_id: existing.user_id,
      alert_type: 'escalated_' + existing.alert_type,
      trust_score: 0,
      trust_score_at_alert: 0,
      anomaly_count: 0,
      severity: 'CRITICAL',
      status: 'OPEN',
      anomaly_summary: { escalated_from: alert_id },
      metadata: { reason: typeof reason === 'string' ? reason.slice(0, 500) : null },
      resolved: false,
    });

    if (error) {
      return respond(res, 500, null, 'Failed to escalate alert.');
    }

    logEvent(existing.user_id, null, 'alert_escalated', null, {
      original_alert_id: alert_id,
      original_type: existing.alert_type,
      reason: typeof reason === 'string' ? reason.slice(0, 500) : null,
    });

    return respond(res, 200, { alert_id, escalated: true });
  } catch (err) {
    console.error('[admin] alert/escalate error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /admin/trust-reset ──
// Reset user's trust score to 1.0 and anomaly_score to 0
router.post('/admin/trust-reset', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { user_id } = req.body;
    if (!user_id || typeof user_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid user_id.');
    }

    const sanitizedId = user_id.trim().slice(0, 128);

    // Verify user exists
    const { data: user } = await supabase
      .from('users')
      .select('id, trust_score, anomaly_score')
      .eq('id', sanitizedId)
      .maybeSingle();

    if (!user) {
      return respond(res, 404, null, 'User not found.');
    }

    // Reset user scores
    const { error: userErr } = await supabase
      .from('users')
      .update({ trust_score: 1.0, anomaly_score: 0 })
      .eq('id', sanitizedId);

    if (userErr) {
      return respond(res, 500, null, 'Failed to reset user trust.');
    }

    // Reset all device scores for this user
    await supabase
      .from('devices')
      .update({ trust_score: 1.0, anomaly_score: 0 })
      .eq('user_id', sanitizedId);

    // Resolve all open alerts for this user
    await supabase
      .from('trust_alerts')
      .update({ resolved: true })
      .eq('user_id', sanitizedId)
      .eq('resolved', false);

    logEvent(sanitizedId, null, 'trust_reset_by_admin', null, {
      previous_trust: Number(user.trust_score),
      previous_anomaly: Number(user.anomaly_score),
    });

    return respond(res, 200, {
      user_id: sanitizedId,
      trust_score: 1.0,
      anomaly_score: 0,
      reset: true,
    });
  } catch (err) {
    console.error('[admin] trust-reset error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /admin/trust-override ──
// Override degraded mode: set trust_score high enough to clear restrictions
router.post('/admin/trust-override', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { user_id } = req.body;
    if (!user_id || typeof user_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid user_id.');
    }

    const sanitizedId = user_id.trim().slice(0, 128);

    // Set anomaly_score to 0 (override) — trust_score stays at current level
    const { error } = await supabase
      .from('users')
      .update({ anomaly_score: 0 })
      .eq('id', sanitizedId);

    if (error) {
      return respond(res, 500, null, 'Failed to override trust.');
    }

    // Also clear device anomaly scores
    await supabase
      .from('devices')
      .update({ anomaly_score: 0 })
      .eq('user_id', sanitizedId);

    logEvent(sanitizedId, null, 'trust_override_by_admin', null, {
      action: 'clear_anomaly_scores',
    });

    const effective = await computeEffectiveScore(sanitizedId, null);

    return respond(res, 200, {
      user_id: sanitizedId,
      effective_trust: effective.effectiveScore,
      overridden: true,
    });
  } catch (err) {
    console.error('[admin] trust-override error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /admin/set-scores ──
// Directly set a user's trust_score and anomaly_score (admin/test use)
router.post('/admin/set-scores', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { user_id, trust_score, anomaly_score } = req.body;
    if (!user_id) return respond(res, 400, null, 'Missing user_id.');

    const updates = {};
    if (trust_score !== undefined) updates.trust_score = Number(trust_score);
    if (anomaly_score !== undefined) updates.anomaly_score = Number(anomaly_score);
    if (Object.keys(updates).length === 0) return respond(res, 400, null, 'No scores to update.');

    const { error } = await supabase.from('users').update(updates).eq('id', user_id);
    if (error) return respond(res, 500, null, 'Failed to set scores.');

    const ts = Number(updates.trust_score ?? 1.0);
    const as = Number(updates.anomaly_score ?? 0);
    const effective = Math.max(0, Math.min(1.0, ts - as));

    return respond(res, 200, { user_id, ...updates, effective_trust: Math.round(effective * 1000) / 1000 });
  } catch (err) {
    console.error('[admin] set-scores error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /admin/inject-anomaly ──
// Insert a test anomaly record (admin/test use)
router.post('/admin/inject-anomaly', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { user_id, device_id, anomaly_type, severity, metadata } = req.body;
    if (!user_id || !anomaly_type) return respond(res, 400, null, 'Missing user_id or anomaly_type.');

    const record = {
      user_id,
      device_id: device_id || null,
      anomaly_type,
      severity: Number(severity) || 0.1,
      metadata: metadata || {},
    };

    const { data, error } = await supabase.from('anomalies').insert(record).select('id');
    if (error) return respond(res, 500, null, `Insert failed: ${error.message}`);

    return respond(res, 200, { anomaly_id: data?.[0]?.id || null });
  } catch (err) {
    console.error('[admin] inject-anomaly error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /admin/check-thresholds ──
// Trigger threshold check + alert generation for a user (admin/test use)
router.post('/admin/check-thresholds', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { user_id, device_id } = req.body;
    if (!user_id) return respond(res, 400, null, 'Missing user_id.');

    // Fetch current scores
    const { data: user } = await supabase
      .from('users')
      .select('trust_score, anomaly_score')
      .eq('id', user_id)
      .maybeSingle();

    if (!user) return respond(res, 404, null, 'User not found.');

    const trustScore = Number(user.trust_score) || 1.0;
    const anomalyScore = Number(user.anomaly_score) || 0;
    const effective = Math.max(0, Math.min(1.0, trustScore - anomalyScore));

    const { checkThresholdsAndAlert } = require('../engines/trustDecayEngine');
    const result = await checkThresholdsAndAlert(user_id, device_id || null, effective, anomalyScore);

    return respond(res, 200, { effective_trust: Math.round(effective * 1000) / 1000, ...result });
  } catch (err) {
    console.error('[admin] check-thresholds error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── GET /admin/config ──
// Returns current trust + alert + enforcement threshold configuration
router.post('/admin/config', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  return respond(res, 200, {
    trust_thresholds: TRUST_THRESHOLDS,
    trust_bands: TRUST_BANDS,
    access_profiles: Object.values(ACCESS_PROFILES),
    alert_thresholds: ALERT_THRESHOLDS,
    alert_count_thresholds: ALERT_COUNT_THRESHOLDS,
    threat_score_thresholds: THREAT_SCORE_THRESHOLDS,
    threat_weights: THREAT_WEIGHTS,
    phase: 29,
    shadow_mode: isShadowModeEnabled(),
    severity_delays: SEVERITY_DELAYS,
    trust_floor_rules: TRUST_FLOOR_RULES,
  });
});

// ════════════════════════════════════════════════════════════════
// Phase 28 — Enforcement Layer Routes
// ════════════════════════════════════════════════════════════════

// ── POST /admin/enforcement-status ──
// Get full enforcement state for a user (access profile, override, feature gate)
router.post('/admin/enforcement-status', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { user_id } = req.body;
    if (!user_id || typeof user_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid user_id.');
    }

    const state = await getEnforcementState(user_id.trim().slice(0, 128));
    const featureGate = getFeatureGate(state.accessProfile);

    return respond(res, 200, {
      ...state,
      featureGate,
    });
  } catch (err) {
    console.error('[admin] enforcement-status error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /admin/force-profile ──
// Admin override: force a user to a specific access profile (24h cooldown)
router.post('/admin/force-profile', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { user_id, profile, reason } = req.body;
    if (!user_id || typeof user_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid user_id.');
    }
    if (!profile || typeof profile !== 'string') {
      return respond(res, 400, null, 'Missing or invalid profile.');
    }

    const sanitizedId = user_id.trim().slice(0, 128);
    const sanitizedProfile = profile.trim().toUpperCase();
    const sanitizedReason = typeof reason === 'string' ? reason.trim().slice(0, 500) : 'admin_override';

    const result = forceProfile(sanitizedId, sanitizedProfile, sanitizedReason);
    if (!result.success) {
      return respond(res, 400, null, result.error);
    }

    logEvent(sanitizedId, null, 'admin_force_profile', null, {
      profile: sanitizedProfile,
      reason: sanitizedReason,
      expires_at: new Date(result.expiresAt).toISOString(),
    });

    return respond(res, 200, {
      user_id: sanitizedId,
      forced_profile: sanitizedProfile,
      expires_at: new Date(result.expiresAt).toISOString(),
    });
  } catch (err) {
    console.error('[admin] force-profile error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /admin/clear-override ──
// Remove active enforcement override for a user
router.post('/admin/clear-override', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { user_id } = req.body;
    if (!user_id || typeof user_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid user_id.');
    }

    const sanitizedId = user_id.trim().slice(0, 128);
    const result = clearOverride(sanitizedId);

    return respond(res, 200, {
      user_id: sanitizedId,
      cleared: result.existed,
    });
  } catch (err) {
    console.error('[admin] clear-override error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /admin/revoke-tokens ──
// Revoke all device tokens for a user (kill switch)
router.post('/admin/revoke-tokens', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { user_id, reason } = req.body;
    if (!user_id || typeof user_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid user_id.');
    }

    const sanitizedId = user_id.trim().slice(0, 128);
    const sanitizedReason = typeof reason === 'string' ? reason.trim().slice(0, 500) : 'ADMIN_REVOCATION';

    const result = await revokeAllTokens(sanitizedId, sanitizedReason);
    if (!result.success) {
      return respond(res, 500, null, `Token revocation failed: ${result.error}`);
    }

    logEvent(sanitizedId, null, 'admin_revoke_tokens', null, {
      reason: sanitizedReason,
      revoked: result.revoked,
    });

    return respond(res, 200, {
      user_id: sanitizedId,
      tokens_revoked: result.revoked,
      reason: sanitizedReason,
    });
  } catch (err) {
    console.error('[admin] revoke-tokens error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /admin/reinstate-tokens ──
// Reinstate all revoked device tokens for a user
router.post('/admin/reinstate-tokens', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { user_id } = req.body;
    if (!user_id || typeof user_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid user_id.');
    }

    const sanitizedId = user_id.trim().slice(0, 128);
    const result = await reinstateTokens(sanitizedId);
    if (!result.success) {
      return respond(res, 500, null, `Token reinstatement failed: ${result.error}`);
    }

    logEvent(sanitizedId, null, 'admin_reinstate_tokens', null, {
      reinstated: result.reinstated,
    });

    return respond(res, 200, {
      user_id: sanitizedId,
      tokens_reinstated: result.reinstated,
    });
  } catch (err) {
    console.error('[admin] reinstate-tokens error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /admin/trigger-recovery ──
// Manually apply soft trust recovery for a user
router.post('/admin/trigger-recovery', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { user_id, hours_clean } = req.body;
    if (!user_id || typeof user_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid user_id.');
    }

    const sanitizedId = user_id.trim().slice(0, 128);
    const hours = Math.min(Math.max(1, Number(hours_clean) || 1), 720); // max 30 days

    const result = await applySoftRecovery(sanitizedId, hours);
    if (!result.success) {
      return respond(res, 500, null, `Recovery failed: ${result.error}`);
    }

    return respond(res, 200, {
      user_id: sanitizedId,
      ...result,
    });
  } catch (err) {
    console.error('[admin] trigger-recovery error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ════════════════════════════════════════════════════════════════
// Phase 29 — Reputation & Recovery Routes
// ════════════════════════════════════════════════════════════════

// ── POST /admin/reputation-status ──
// Full reputation summary for a user
router.post('/admin/reputation-status', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { user_id } = req.body;
    if (!user_id || typeof user_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid user_id.');
    }

    const summary = await getReputationSummary(user_id.trim().slice(0, 128));
    if (!summary.success) {
      return respond(res, 500, null, `Reputation query failed: ${summary.error}`);
    }

    return respond(res, 200, summary);
  } catch (err) {
    console.error('[admin] reputation-status error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /admin/reputation-recovery ──
// Reputation-aware trust recovery (replaces flat trigger-recovery for Phase 29)
router.post('/admin/reputation-recovery', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { user_id, hours_clean } = req.body;
    if (!user_id || typeof user_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid user_id.');
    }

    const sanitizedId = user_id.trim().slice(0, 128);
    const hours = Math.min(Math.max(1, Number(hours_clean) || 1), 720);

    const result = await applyReputationRecovery(sanitizedId, hours);
    if (!result.success) {
      return respond(res, 500, null, `Recovery failed: ${result.error}`);
    }

    return respond(res, 200, { user_id: sanitizedId, ...result });
  } catch (err) {
    console.error('[admin] reputation-recovery error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /admin/false-positive ──
// Resolve an alert as false positive → reverse trust decay + remove impact
router.post('/admin/false-positive', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { user_id, alert_id, notes } = req.body;
    if (!user_id || typeof user_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid user_id.');
    }
    if (!alert_id || typeof alert_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid alert_id.');
    }

    const result = await resolveAsFalsePositive(
      user_id.trim().slice(0, 128),
      alert_id.trim().slice(0, 128),
      typeof notes === 'string' ? notes.slice(0, 500) : 'False positive',
    );

    if (!result.success) {
      return respond(res, result.error === 'alert_not_found' ? 404 : 500, null, result.error);
    }

    return respond(res, 200, result);
  } catch (err) {
    console.error('[admin] false-positive error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /admin/shadow-mode ──
// Enable/disable shadow mode (log-only enforcement comparison)
router.post('/admin/shadow-mode', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return respond(res, 400, null, 'Missing or invalid enabled (boolean).');
    }

    const result = setShadowMode(enabled);
    logEvent(null, null, 'shadow_mode_toggled', null, { enabled: result.shadow_mode });

    return respond(res, 200, result);
  } catch (err) {
    console.error('[admin] shadow-mode error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /admin/trust-floor ──
// Apply trust floor for a user (caps trust based on reputation)
router.post('/admin/trust-floor', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { user_id } = req.body;
    if (!user_id || typeof user_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid user_id.');
    }

    const result = await applyTrustFloor(user_id.trim().slice(0, 128));
    if (!result.success) {
      return respond(res, 500, null, `Trust floor failed: ${result.error}`);
    }

    return respond(res, 200, { user_id: user_id.trim().slice(0, 128), ...result });
  } catch (err) {
    console.error('[admin] trust-floor error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /admin/reputation-decay ──
// Apply weekly reputation decay (forgiveness over time)
router.post('/admin/reputation-decay', async (req, res) => {
  if (!validateAdminSecret(req, res)) return;

  try {
    const { user_id } = req.body;
    if (!user_id || typeof user_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid user_id.');
    }

    const result = await decayReputation(user_id.trim().slice(0, 128));
    if (!result.success) {
      return respond(res, 500, null, `Decay failed: ${result.error}`);
    }

    return respond(res, 200, { user_id: user_id.trim().slice(0, 128), ...result });
  } catch (err) {
    console.error('[admin] reputation-decay error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

module.exports = router;
