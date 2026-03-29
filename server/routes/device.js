/**
 * POST /verify/device — Device fingerprint + trust scoring.
 * No trust middleware (device may not exist yet — this is registration).
 * Phase 23: Full audit remediation.
 *   - HMAC-SHA256 signature validation (S1 fix)
 *   - Semver comparison for version downgrade (S4 fix)
 *   - trust_score, anomaly_score, effective_trust: INTERNAL ONLY, never in response
 *   - Enriched anomaly metadata (ip_origin, device_fingerprint, request_headers, payload_hash)
 *   - computeEffectiveScore computed once per request server-side
 *   - Anomaly evaluation on every device event
 */
'use strict';

const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabaseClient');
const respond = require('../utils/respond');
const logEvent = require('../utils/logEvent');
const { evaluateUserActivity } = require('../engines/anomalyEngine');
const { isVersionDowngrade } = require('../utils/semver');

/**
 * Verify HMAC-SHA256 device signature.
 * Signature = HMAC-SHA256(user_id|device_id|app_version, DEVICE_SIGNING_SECRET)
 * Uses constant-time comparison to prevent timing attacks.
 */
function verifyDeviceSignature(userId, deviceId, appVersion, signature) {
  const secret = process.env.DEVICE_SIGNING_SECRET;
  if (!secret) {
    // If no secret configured, reject all requests (fail closed)
    console.error('[/verify/device] DEVICE_SIGNING_SECRET not configured — rejecting.');
    return false;
  }
  try {
    const payload = `${userId}|${deviceId}|${appVersion}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (expected.length !== signature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
  } catch {
    return false;
  }
}

router.post('/verify/device', async (req, res) => {
  try {
    const { user_id, device_id, app_version, signature } = req.body;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    // Validate required fields
    if (!user_id || typeof user_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "user_id" field.');
    }
    if (!device_id || typeof device_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "device_id" field.');
    }
    if (!app_version || typeof app_version !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "app_version" field.');
    }
    if (!signature || typeof signature !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "signature" field.');
    }

    // S1 fix: HMAC-SHA256 signature validation (fail closed)
    const sanitizedUserId = user_id.trim().slice(0, 128);
    const sanitizedDeviceId = device_id.trim().slice(0, 256);
    const sanitizedAppVersion = app_version.trim().slice(0, 32);

    if (!verifyDeviceSignature(sanitizedUserId, sanitizedDeviceId, sanitizedAppVersion, signature)) {
      const ip2 = req.ip || req.connection.remoteAddress || 'unknown';
      logEvent(sanitizedUserId, sanitizedDeviceId, 'device_invalid_signature', ip2);
      return respond(res, 403, null, 'Invalid device signature.');
    }

    // Check if user exists
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('id', sanitizedUserId)
      .maybeSingle();

    if (!user) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'device_verify_unknown_user', ip);
      return respond(res, 403, null, 'Unknown user. Register first via /user/create.');
    }

    // Check existing device record
    const { data: existingDevice } = await supabase
      .from('devices')
      .select('device_id, user_id, trust_score, app_version')
      .eq('device_id', sanitizedDeviceId)
      .maybeSingle();

    let trustScore = 1.0;
    let eventType = 'device_registered';

    if (existingDevice) {
      // Existing device — compute updated trust score
      eventType = 'device_verified';
      trustScore = Number(existingDevice.trust_score) || 1.0;

      // ── Trust adjustments ──

      // Device switching users → suspicious (reduce trust)
      if (existingDevice.user_id && existingDevice.user_id !== sanitizedUserId) {
        trustScore = Math.max(0, trustScore - 0.2);
        logEvent(sanitizedUserId, sanitizedDeviceId, 'device_user_switch', ip, {
          previous_user: existingDevice.user_id,
          new_user: sanitizedUserId,
          trust_delta: -0.2,
        });
      }

      // App version downgrade → suspicious (reduce trust) — S4 fix: proper semver
      if (existingDevice.app_version && isVersionDowngrade(sanitizedAppVersion, existingDevice.app_version)) {
        trustScore = Math.max(0, trustScore - 0.1);
        logEvent(sanitizedUserId, sanitizedDeviceId, 'app_version_downgrade', ip, {
          previous_version: existingDevice.app_version,
          new_version: sanitizedAppVersion,
          trust_delta: -0.1,
        });
      }

      // Normal verification with valid signature → slight trust recovery
      if (trustScore < 1.0 && trustScore >= 0.3) {
        trustScore = Math.min(1.0, trustScore + 0.05);
      }
    }

    // Upsert device
    const { error } = await supabase
      .from('devices')
      .upsert({
        device_id: sanitizedDeviceId,
        user_id: sanitizedUserId,
        app_version: sanitizedAppVersion,
        last_seen: new Date().toISOString(),
        trust_score: trustScore,
      }, {
        onConflict: 'device_id',
      });

    if (error) {
      console.error('[/verify/device] Supabase error:', error.message);
      // Non-fatal — still return current trust score
    }

    logEvent(sanitizedUserId, sanitizedDeviceId, eventType, ip, {
      trust_score: trustScore,
      app_version: sanitizedAppVersion,
    });

    // Phase 22.3: Real-time anomaly evaluation with request context
    const anomaly = await evaluateUserActivity(sanitizedUserId, sanitizedDeviceId, {
      ip,
      app_version: sanitizedAppVersion,
      previous_version: existingDevice?.app_version || null,
      event_type: 'verify_device',
    }, {
      ip,
      headers: req.headers,
      body: req.body,
    });

    // Phase 22.3: effectiveScore computed once by engine — no double subtraction
    const effectiveScore = anomaly.effectiveScore;

    // Enforcement: device anomaly_score > 0.5 → mark untrusted
    let deviceUntrusted = false;
    if (anomaly.anomalyScore > 0.5) {
      deviceUntrusted = true;
      logEvent(sanitizedUserId, sanitizedDeviceId, 'device_untrusted', ip, {
        triggered: anomaly.triggered,
      });
    }

    // Phase 22.3: trust_score, anomaly_score, effective_trust ALL hidden from client
    return respond(res, 200, {
      user_id: sanitizedUserId,
      device_id: sanitizedDeviceId,
      untrusted: deviceUntrusted,
      verified_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[/verify/device] Unexpected error:', err.message, err.stack);
    return respond(res, 500, null, 'Internal server error.');
  }
});

module.exports = router;
