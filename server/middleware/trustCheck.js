/**
 * Trust scoring middleware — Phase 27 (Trust Decay + Alerting).
 *
 * Enforces trust thresholds BEFORE endpoint logic executes.
 * Reads DB-persisted anomaly_score (set by anomalyEngine) — no per-request computation.
 *
 *   effective_score = trust_score - anomaly_score
 *
 * Phase 27 thresholds:
 *   >= 0.6  → full access
 *   0.3–0.6 → degraded mode (restricted features, req.degraded = true)
 *   < 0.3   → soft block (req.softBlocked = true, alert generated — no hard 403)
 *
 * Phase 27 changes:
 *   - THRESHOLD_RESTRICTED raised from 0.5 → 0.6
 *   - Hard 403 at <0.3 replaced with soft block + admin alert
 *   - req.softBlocked flag for routes to enforce restrictions
 *   - Backward compat: req.restricted still set for <0.6
 *   - Trust alert generation on threshold breach
 *
 * Attaches: req.user, req.device, req.restricted, req.degraded, req.softBlocked,
 *           req.effectiveTrust, req.anomalyScore, req.backendVerified.
 */
'use strict';

const supabase = require('../utils/supabaseClient');
const logEvent = require('../utils/logEvent');
const respond = require('../utils/respond');
const { checkThresholdsAndAlert, TRUST_THRESHOLDS } = require('../engines/trustDecayEngine');

// ── Thresholds (Phase 27: raised restricted from 0.5 → 0.6) ──
const THRESHOLD_RESTRICTED = TRUST_THRESHOLDS.degraded;   // 0.6
const THRESHOLD_SOFT_BLOCK = TRUST_THRESHOLDS.softBlock;   // 0.3

async function trustCheck(req, res, next) {
  const { user_id, device_id } = req.body;
  const ip = req.ip || req.connection.remoteAddress || 'unknown';

  if (!user_id || typeof user_id !== 'string') {
    return respond(res, 400, null, 'Missing or invalid "user_id" field.');
  }
  if (!device_id || typeof device_id !== 'string') {
    return respond(res, 400, null, 'Missing or invalid "device_id" field.');
  }

  const sanitizedUserId = user_id.trim().slice(0, 128);
  const sanitizedDeviceId = device_id.trim().slice(0, 256);

  try {
    // P1 optimization: parallel user + device DB reads (saves ~50ms per request)
    const [deviceResult, userResult] = await Promise.all([
      // Fetch device (anomaly_score may not exist yet if schema not updated)
      (async () => {
        const deviceQuery = await supabase
          .from('devices')
          .select('device_id, user_id, app_version, trust_score, anomaly_score, last_seen')
          .eq('device_id', sanitizedDeviceId)
          .maybeSingle();

        if (deviceQuery.error && deviceQuery.error.message?.includes('anomaly_score')) {
          const fallback = await supabase
            .from('devices')
            .select('device_id, user_id, app_version, trust_score, last_seen')
            .eq('device_id', sanitizedDeviceId)
            .maybeSingle();
          return { data: fallback.data, error: fallback.error };
        }
        return { data: deviceQuery.data, error: deviceQuery.error };
      })(),
      // Fetch user (anomaly_score may not exist yet if schema not updated)
      (async () => {
        const userQuery = await supabase
          .from('users')
          .select('id, email, trust_score, anomaly_score')
          .eq('id', sanitizedUserId)
          .maybeSingle();

        if (userQuery.error && userQuery.error.message?.includes('anomaly_score')) {
          const fallback = await supabase
            .from('users')
            .select('id, email, trust_score')
            .eq('id', sanitizedUserId)
            .maybeSingle();
          return { data: fallback.data, error: fallback.error };
        }
        return { data: userQuery.data, error: userQuery.error };
      })(),
    ]);

    const device = deviceResult.data;
    const deviceErr = deviceResult.error;
    const user = userResult.data;
    const userErr = userResult.error;

    if (deviceErr) {
      console.error('[trustCheck] Device lookup error:', deviceErr.message);
    }

    if (!device) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'unknown_device', ip);
      return respond(res, 403, null, 'Unknown device. Register first via /verify/device.');
    }

    if (device.user_id && device.user_id !== sanitizedUserId) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'device_user_mismatch', ip, {
        claimed_user: sanitizedUserId,
        actual_user: device.user_id,
      });
      return respond(res, 403, null, 'Device is not registered to this user.');
    }

    if (userErr) {
      console.error('[trustCheck] User lookup error:', userErr.message);
    }

    if (!user) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'unknown_user', ip);
      return respond(res, 403, null, 'Unknown user. Register first via /user/create.');
    }

    // ── Compute effective trust from DB-persisted scores ──
    const userTrust = Number(user.trust_score) || 1.0;
    const deviceTrust = Number(device.trust_score) || 1.0;
    const baseTrust = Math.min(userTrust, deviceTrust);

    // Use the higher of user-level or device-level anomaly score
    const anomalyScore = Math.max(
      Number(user.anomaly_score) || 0,
      Number(device.anomaly_score) || 0
    );

    const effectiveTrust = Math.max(0, Math.min(1.0, baseTrust - anomalyScore));

    // ── Enforce thresholds (Phase 27: soft block replaces hard 403) ──
    const softBlocked = effectiveTrust < THRESHOLD_SOFT_BLOCK;
    const degraded = effectiveTrust < THRESHOLD_RESTRICTED;

    if (softBlocked) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'access_soft_blocked', ip, {
        user_trust: userTrust,
        device_trust: deviceTrust,
        anomaly_score: anomalyScore,
        effective: effectiveTrust,
      });
      // Fire-and-forget: generate admin alert
      checkThresholdsAndAlert(sanitizedUserId, sanitizedDeviceId, effectiveTrust, anomalyScore);
    } else if (degraded) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'access_degraded', ip, {
        user_trust: userTrust,
        device_trust: deviceTrust,
        anomaly_score: anomalyScore,
        effective: effectiveTrust,
      });
      // Fire-and-forget: generate admin alert if threshold breached
      checkThresholdsAndAlert(sanitizedUserId, sanitizedDeviceId, effectiveTrust, anomalyScore);
    }

    // ── Attach to request ──
    req.user = user;
    req.device = device;
    req.restricted = degraded;       // backward compat
    req.degraded = degraded;         // Phase 27: clearer name
    req.softBlocked = softBlocked;   // Phase 27: soft block flag
    req.effectiveTrust = effectiveTrust;
    req.anomalyScore = anomalyScore;
    req.backendVerified = true;

    logEvent(sanitizedUserId, sanitizedDeviceId, 'trust_check_passed', ip, {
      effective: effectiveTrust,
      anomaly_score: anomalyScore,
      restricted,
    });

    next();
  } catch (err) {
    console.error('[trustCheck] Unexpected error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
}

module.exports = trustCheck;
module.exports.THRESHOLD_RESTRICTED = THRESHOLD_RESTRICTED;
module.exports.THRESHOLD_SOFT_BLOCK = THRESHOLD_SOFT_BLOCK;
