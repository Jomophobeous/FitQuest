/**
 * Phase 25A — Challenge-Response Authentication
 *
 * POST /auth/challenge  — Issue a time-limited challenge (nonce + metadata)
 * POST /auth/verify     — Validate client response, run anomaly detection, return trust result
 *
 * Security model:
 *   - No secrets on client. Client hashes: SHA-256(nonce + device_id + app_version)
 *   - Server stores challenge state (device_id, user_id) — verifies hash matches
 *   - Challenges expire after 60s and are single-use (consumed on verify)
 *   - Trust anchored entirely on server: ephemeral nonce, TTL, replay protection
 *
 * In-memory challenge store with periodic TTL cleanup.
 * For horizontal scaling, replace with Redis or Supabase row.
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

// ── Challenge Store (in-memory) ──

const CHALLENGE_TTL_MS = 60 * 1000; // 60 seconds
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Map<challenge_id, ChallengeRecord>
 * @typedef {{
 *   nonce: string,
 *   user_id: string,
 *   device_id: string,
 *   expires_at: number,
 *   consumed: boolean,
 *   created_at: number
 * }} ChallengeRecord
 */
const challengeStore = new Map();

// Periodic cleanup of expired/consumed challenges
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, record] of challengeStore) {
    // Remove if expired (with 30s grace) or consumed
    if (record.consumed || now > record.expires_at + 30_000) {
      challengeStore.delete(id);
    }
  }
}, CLEANUP_INTERVAL_MS);
cleanupTimer.unref(); // Don't block process exit

// ── POST /auth/challenge ──

router.post('/auth/challenge', (req, res) => {
  try {
    const { user_id, device_id } = req.body;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    // Validate required fields
    if (!user_id || typeof user_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "user_id" field.');
    }
    if (!device_id || typeof device_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "device_id" field.');
    }

    const sanitizedUserId = user_id.trim().slice(0, 128);
    const sanitizedDeviceId = device_id.trim().slice(0, 256);

    // Generate cryptographically random challenge
    const challengeId = crypto.randomUUID();
    const nonce = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresAt = now + CHALLENGE_TTL_MS;

    // Store challenge
    challengeStore.set(challengeId, {
      nonce,
      user_id: sanitizedUserId,
      device_id: sanitizedDeviceId,
      expires_at: expiresAt,
      consumed: false,
      created_at: now,
    });

    logEvent(sanitizedUserId, sanitizedDeviceId, 'auth_challenge_issued', ip, {
      challenge_id: challengeId,
    });

    return respond(res, 200, {
      challenge_id: challengeId,
      nonce,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error('[/auth/challenge] Unexpected error:', err.message, err.stack);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /auth/verify ──

router.post('/auth/verify', async (req, res) => {
  try {
    const { challenge_id, response, app_version } = req.body;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    // Validate required fields
    if (!challenge_id || typeof challenge_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "challenge_id" field.');
    }
    if (!response || typeof response !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "response" field.');
    }
    if (!app_version || typeof app_version !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "app_version" field.');
    }

    const sanitizedAppVersion = app_version.trim().slice(0, 32);

    // Look up challenge
    const challenge = challengeStore.get(challenge_id);

    if (!challenge) {
      return respond(res, 400, null, 'Challenge not found or already consumed.');
    }

    // Check expiration
    if (Date.now() > challenge.expires_at) {
      challengeStore.delete(challenge_id);
      logEvent(challenge.user_id, challenge.device_id, 'auth_challenge_expired', ip, {
        challenge_id,
      });
      return respond(res, 403, null, 'Challenge expired.');
    }

    // Check replay (already consumed)
    if (challenge.consumed) {
      logEvent(challenge.user_id, challenge.device_id, 'auth_challenge_replay', ip, {
        challenge_id,
      });
      return respond(res, 403, null, 'Challenge already consumed.');
    }

    // Mark consumed BEFORE validation to prevent race conditions
    challenge.consumed = true;

    // Reconstruct expected response: SHA-256(nonce + device_id + app_version)
    const expectedPayload = `${challenge.nonce}${challenge.device_id}${sanitizedAppVersion}`;
    const expected = crypto.createHash('sha256').update(expectedPayload).digest('hex');

    // Constant-time comparison
    if (expected.length !== response.length) {
      logEvent(challenge.user_id, challenge.device_id, 'auth_verify_tampered', ip, {
        challenge_id,
        reason: 'length_mismatch',
      });
      return respond(res, 403, null, 'Invalid challenge response.');
    }

    const match = crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(response, 'utf8'),
    );

    if (!match) {
      logEvent(challenge.user_id, challenge.device_id, 'auth_verify_tampered', ip, {
        challenge_id,
        reason: 'hash_mismatch',
      });
      return respond(res, 403, null, 'Invalid challenge response.');
    }

    // ── Challenge verified — now run device trust logic (mirrors device.js) ──

    const sanitizedUserId = challenge.user_id;
    const sanitizedDeviceId = challenge.device_id;

    // Verify user exists
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('id', sanitizedUserId)
      .maybeSingle();

    if (!user) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'auth_verify_unknown_user', ip);
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
      eventType = 'device_verified';
      trustScore = Number(existingDevice.trust_score) || 1.0;

      // Device switching users → suspicious
      if (existingDevice.user_id && existingDevice.user_id !== sanitizedUserId) {
        trustScore = Math.max(0, trustScore - 0.2);
        logEvent(sanitizedUserId, sanitizedDeviceId, 'device_user_switch', ip, {
          previous_user: existingDevice.user_id,
          new_user: sanitizedUserId,
          trust_delta: -0.2,
        });
      }

      // App version downgrade → suspicious
      if (existingDevice.app_version && isVersionDowngrade(sanitizedAppVersion, existingDevice.app_version)) {
        trustScore = Math.max(0, trustScore - 0.1);
        logEvent(sanitizedUserId, sanitizedDeviceId, 'app_version_downgrade', ip, {
          previous_version: existingDevice.app_version,
          new_version: sanitizedAppVersion,
          trust_delta: -0.1,
        });
      }

      // Normal verification → slight trust recovery
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
      console.error('[/auth/verify] Supabase upsert error:', error.message);
    }

    logEvent(sanitizedUserId, sanitizedDeviceId, eventType, ip, {
      trust_score: trustScore,
      app_version: sanitizedAppVersion,
      auth_method: 'challenge_response',
    });

    // Anomaly evaluation (same as device.js)
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

    let deviceUntrusted = false;
    if (anomaly.anomalyScore > 0.5) {
      deviceUntrusted = true;
      logEvent(sanitizedUserId, sanitizedDeviceId, 'device_untrusted', ip, {
        triggered: anomaly.triggered,
      });
    }

    // Response matches device.js shape for client compatibility
    return respond(res, 200, {
      user_id: sanitizedUserId,
      device_id: sanitizedDeviceId,
      untrusted: deviceUntrusted,
      verified_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[/auth/verify] Unexpected error:', err.message, err.stack);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── Exports for testing ──

router._challengeStore = challengeStore;

module.exports = router;
