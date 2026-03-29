/**
 * Trust scoring middleware — Phase 22.3.
 *
 * Enforces trust thresholds BEFORE endpoint logic executes.
 * Reads DB-persisted anomaly_score (set by anomalyEngine) — no per-request computation.
 *
 *   effective_score = trust_score - anomaly_score
 *
 * Thresholds:
 *   >= 0.5  → full access
 *   0.3–0.5 → restricted (feature degradation, req.restricted = true)
 *   < 0.3   → suspended (403 — access denied)
 *
 * Phase 22.3 additions:
 *   - Backend verification flag (req.backendVerified = true)
 *   - trust_score and anomaly_score NEVER exposed to client
 *   - All sensitive computation server-side only
 *
 * Attaches: req.user, req.device, req.restricted, req.effectiveTrust,
 *           req.anomalyScore, req.backendVerified.
 */
'use strict';

const supabase = require('../utils/supabaseClient');
const logEvent = require('../utils/logEvent');
const respond = require('../utils/respond');

// ── Thresholds ──
const THRESHOLD_RESTRICTED = 0.5;
const THRESHOLD_SUSPENDED = 0.3;

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
    // Fetch device (anomaly_score may not exist yet if schema not updated)
    let device = null;
    let deviceErr = null;

    const deviceQuery = await supabase
      .from('devices')
      .select('device_id, user_id, app_version, trust_score, anomaly_score, last_seen')
      .eq('device_id', sanitizedDeviceId)
      .maybeSingle();

    if (deviceQuery.error && deviceQuery.error.message?.includes('anomaly_score')) {
      // Fallback: schema not updated yet — query without anomaly_score
      const fallback = await supabase
        .from('devices')
        .select('device_id, user_id, app_version, trust_score, last_seen')
        .eq('device_id', sanitizedDeviceId)
        .maybeSingle();
      device = fallback.data;
      deviceErr = fallback.error;
    } else {
      device = deviceQuery.data;
      deviceErr = deviceQuery.error;
    }

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

    // Fetch user (anomaly_score may not exist yet if schema not updated)
    let user = null;
    let userErr = null;

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
      user = fallback.data;
      userErr = fallback.error;
    } else {
      user = userQuery.data;
      userErr = userQuery.error;
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

    // ── Enforce thresholds ──
    if (effectiveTrust < THRESHOLD_SUSPENDED) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'access_suspended', ip, {
        user_trust: userTrust,
        device_trust: deviceTrust,
        anomaly_score: anomalyScore,
        effective: effectiveTrust,
      });
      return respond(res, 403, null, 'Access temporarily suspended.');
    }

    const restricted = effectiveTrust < THRESHOLD_RESTRICTED;
    if (restricted) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'access_restricted', ip, {
        user_trust: userTrust,
        device_trust: deviceTrust,
        anomaly_score: anomalyScore,
        effective: effectiveTrust,
      });
    }

    // ── Attach to request ──
    req.user = user;
    req.device = device;
    req.restricted = restricted;
    req.effectiveTrust = effectiveTrust;
    req.anomalyScore = anomalyScore;
    req.backendVerified = true; // Phase 22.3: backend verification flag for critical routes

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
module.exports.THRESHOLD_SUSPENDED = THRESHOLD_SUSPENDED;
