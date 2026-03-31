/**
 * Phase 26 — Device Binding & Persistent Trust
 *
 * POST /device/register — Issue a server-generated device_token after challenge-response auth.
 * POST /device/revoke  — Revoke a device_token (user or system initiated).
 * POST /device/rotate  — Invalidate old token, issue new one (anomaly-driven).
 *
 * Security model:
 *   - device_token is a 256-bit CSPRNG hex string (unguessable)
 *   - Never derived from device_id or any client-supplied value
 *   - Stored server-side in device_tokens table
 *   - Client stores in SecureStore, attaches to ALL protected requests
 *   - Multi-device: max 5 active tokens per user
 */
'use strict';

const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabaseClient');
const respond = require('../utils/respond');
const logEvent = require('../utils/logEvent');

const MAX_DEVICES_PER_USER = 5;

// Import challenge store from auth route (shared in-memory)
const authRouter = require('./auth');
const challengeStore = authRouter._challengeStore;

// ── POST /device/register ──

/**
 * Issue a device_token after successful challenge-response verification.
 *
 * Body: { user_id, device_id, app_version, challenge_id, challenge_response }
 * Returns: { device_token }
 *
 * If device already has an active token for this user+device pair,
 * returns the existing token (idempotent).
 */
router.post('/device/register', async (req, res) => {
  try {
    const { user_id, device_id, app_version, challenge_id, challenge_response } = req.body;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    // ── Input Validation ──
    if (!user_id || typeof user_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "user_id".');
    }
    if (!device_id || typeof device_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "device_id".');
    }
    if (!app_version || typeof app_version !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "app_version".');
    }
    if (!challenge_id || typeof challenge_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "challenge_id".');
    }
    if (!challenge_response || typeof challenge_response !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "challenge_response".');
    }

    const sanitizedUserId = user_id.trim().slice(0, 128);
    const sanitizedDeviceId = device_id.trim().slice(0, 256);
    const sanitizedAppVersion = app_version.trim().slice(0, 32);

    // ── Challenge-Response Verification ──
    const challenge = challengeStore ? challengeStore.get(challenge_id) : null;

    if (!challenge) {
      return respond(res, 403, null, 'Invalid or expired challenge.');
    }
    if (Date.now() > challenge.expires_at) {
      challengeStore.delete(challenge_id);
      return respond(res, 403, null, 'Challenge expired.');
    }
    if (challenge.consumed) {
      return respond(res, 403, null, 'Challenge already consumed.');
    }
    if (challenge.device_id !== sanitizedDeviceId) {
      return respond(res, 403, null, 'Device mismatch.');
    }
    if (challenge.user_id !== sanitizedUserId) {
      return respond(res, 403, null, 'User mismatch.');
    }

    // Mark consumed (prevent race)
    challenge.consumed = true;

    // Verify hash: SHA-256(nonce + device_id + app_version)
    const expectedPayload = `${challenge.nonce}${sanitizedDeviceId}${sanitizedAppVersion}`;
    const expected = crypto.createHash('sha256').update(expectedPayload).digest('hex');

    if (expected.length !== challenge_response.length ||
        !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(challenge_response))) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'device_register_auth_failed', ip);
      return respond(res, 403, null, 'Challenge verification failed.');
    }

    // ── Verify User Exists ──
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('id', sanitizedUserId)
      .maybeSingle();

    if (!user) {
      return respond(res, 403, null, 'Unknown user. Register first via /user/create.');
    }

    // ── Ensure Device Record Exists (upsert) ──
    await supabase
      .from('devices')
      .upsert({
        device_id: sanitizedDeviceId,
        user_id: sanitizedUserId,
        app_version: sanitizedAppVersion,
        last_seen: new Date().toISOString(),
      }, { onConflict: 'device_id' });

    // ── Check Existing Active Token (atomic: select-for-update via conditional update) ──
    // First, try to claim an existing active token by updating last_seen.
    // The update returns the row only if one exists — this is atomic.
    const { data: claimed } = await supabase
      .from('device_tokens')
      .update({ last_seen: new Date().toISOString() })
      .eq('user_id', sanitizedUserId)
      .eq('device_id', sanitizedDeviceId)
      .eq('revoked', false)
      .select('device_token')
      .maybeSingle();

    if (claimed) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'device_token_reissued', ip);
      return respond(res, 200, {
        device_token: claimed.device_token,
        is_new: false,
      });
    }

    // ── Multi-Device Limit ──
    const { count: activeCount } = await supabase
      .from('device_tokens')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', sanitizedUserId)
      .eq('revoked', false);

    if (activeCount >= MAX_DEVICES_PER_USER) {
      const { data: oldest } = await supabase
        .from('device_tokens')
        .select('id, device_id')
        .eq('user_id', sanitizedUserId)
        .eq('revoked', false)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (oldest) {
        await supabase
          .from('device_tokens')
          .update({
            revoked: true,
            revoked_at: new Date().toISOString(),
            revoke_reason: 'max_devices_exceeded',
          })
          .eq('id', oldest.id);

        logEvent(sanitizedUserId, oldest.device_id, 'device_token_auto_revoked', ip, {
          reason: 'max_devices_exceeded',
          limit: MAX_DEVICES_PER_USER,
        });
      }
    }

    // ── Generate Token (256-bit CSPRNG) ──
    const deviceToken = crypto.randomBytes(32).toString('hex');

    const { error: insertError } = await supabase
      .from('device_tokens')
      .insert({
        user_id: sanitizedUserId,
        device_id: sanitizedDeviceId,
        device_token: deviceToken,
      });

    if (insertError) {
      console.error('[/device/register] Insert error:', insertError.message);
      return respond(res, 500, null, 'Failed to register device token.');
    }

    // ── Optimistic concurrency: detect and resolve concurrent inserts ──
    // If two requests raced past the "claimed" check and both inserted,
    // both will see >1 active tokens. Deterministically keep the earliest.
    const { data: activeTokens } = await supabase
      .from('device_tokens')
      .select('id, device_token, created_at')
      .eq('user_id', sanitizedUserId)
      .eq('device_id', sanitizedDeviceId)
      .eq('revoked', false)
      .order('created_at', { ascending: true });

    if (activeTokens && activeTokens.length > 1) {
      // Race detected — keep earliest, revoke the rest
      const keepToken = activeTokens[0];
      const revokeIds = activeTokens.slice(1).map(t => t.id);

      await supabase
        .from('device_tokens')
        .update({
          revoked: true,
          revoked_at: new Date().toISOString(),
          revoke_reason: 'concurrent_registration_cleanup',
        })
        .in('id', revokeIds);

      logEvent(sanitizedUserId, sanitizedDeviceId, 'device_token_race_resolved', ip, {
        kept_token_id: keepToken.id,
        revoked_count: revokeIds.length,
      });

      return respond(res, 200, {
        device_token: keepToken.device_token,
        is_new: true,
      });
    }

    // If another concurrent request already cleaned up our token,
    // return the surviving active token instead of our (now-revoked) one.
    if (activeTokens && activeTokens.length === 1 && activeTokens[0].device_token !== deviceToken) {
      return respond(res, 200, {
        device_token: activeTokens[0].device_token,
        is_new: false,
      });
    }

    // If no active tokens remain (edge case: our token was revoked and no winner survived),
    // re-query to find the current active token.
    if (!activeTokens || activeTokens.length === 0) {
      const { data: fallback } = await supabase
        .from('device_tokens')
        .select('device_token')
        .eq('user_id', sanitizedUserId)
        .eq('device_id', sanitizedDeviceId)
        .eq('revoked', false)
        .limit(1)
        .maybeSingle();

      if (fallback) {
        return respond(res, 200, {
          device_token: fallback.device_token,
          is_new: false,
        });
      }
    }

    logEvent(sanitizedUserId, sanitizedDeviceId, 'device_token_issued', ip, {
      is_new: true,
    });

    return respond(res, 200, {
      device_token: deviceToken,
      is_new: true,
    });

  } catch (err) {
    console.error('[/device/register] Unexpected error:', err.message, err.stack);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /device/revoke ──

/**
 * Revoke a device_token.
 * Requires current valid device_token for auth (or system-level trigger).
 *
 * Body: { user_id, device_id, device_token, target_device_id? }
 * If target_device_id is provided, revokes that device instead (user revoking another device).
 */
router.post('/device/revoke', async (req, res) => {
  try {
    const { user_id, device_id, device_token, target_device_id, reason } = req.body;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    // ── Input Validation ──
    if (!user_id || typeof user_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "user_id".');
    }
    if (!device_id || typeof device_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "device_id".');
    }
    if (!device_token || typeof device_token !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "device_token".');
    }

    const sanitizedUserId = user_id.trim().slice(0, 128);
    const sanitizedDeviceId = device_id.trim().slice(0, 256);

    // ── Verify requesting device's token ──
    const { data: callerToken } = await supabase
      .from('device_tokens')
      .select('id, user_id, device_id')
      .eq('device_token', device_token)
      .eq('revoked', false)
      .maybeSingle();

    if (!callerToken) {
      return respond(res, 401, null, 'Invalid or revoked device token.');
    }
    if (callerToken.user_id !== sanitizedUserId || callerToken.device_id !== sanitizedDeviceId) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'device_revoke_mismatch', ip);
      return respond(res, 403, null, 'Token does not match user/device.');
    }

    // ── Determine target ──
    const revokeDeviceId = (target_device_id && typeof target_device_id === 'string')
      ? target_device_id.trim().slice(0, 256)
      : sanitizedDeviceId;

    const revokeReason = (reason && typeof reason === 'string')
      ? reason.trim().slice(0, 256)
      : 'user_revoked';

    // ── Revoke target device's token(s) ──
    const { data: revoked, error: revokeError } = await supabase
      .from('device_tokens')
      .update({
        revoked: true,
        revoked_at: new Date().toISOString(),
        revoke_reason: revokeReason,
      })
      .eq('user_id', sanitizedUserId)
      .eq('device_id', revokeDeviceId)
      .eq('revoked', false)
      .select('id');

    if (revokeError) {
      console.error('[/device/revoke] Revoke error:', revokeError.message);
      return respond(res, 500, null, 'Failed to revoke device token.');
    }

    const revokedCount = revoked?.length || 0;

    logEvent(sanitizedUserId, revokeDeviceId, 'device_token_revoked', ip, {
      reason: revokeReason,
      revoked_count: revokedCount,
      self_revoke: revokeDeviceId === sanitizedDeviceId,
    });

    return respond(res, 200, {
      revoked: revokedCount > 0,
      revoked_count: revokedCount,
    });

  } catch (err) {
    console.error('[/device/revoke] Unexpected error:', err.message, err.stack);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /device/rotate ──

/**
 * Token rotation: invalidate current token, issue new one.
 * Triggered on anomaly detection or client-initiated rotation.
 *
 * Body: { user_id, device_id, device_token, app_version, challenge_id, challenge_response }
 * Returns: { device_token } (new token)
 */
router.post('/device/rotate', async (req, res) => {
  try {
    const { user_id, device_id, device_token, app_version, challenge_id, challenge_response } = req.body;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    // ── Input Validation ──
    if (!user_id || typeof user_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "user_id".');
    }
    if (!device_id || typeof device_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "device_id".');
    }
    if (!device_token || typeof device_token !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "device_token".');
    }
    if (!app_version || typeof app_version !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "app_version".');
    }
    if (!challenge_id || typeof challenge_id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "challenge_id".');
    }
    if (!challenge_response || typeof challenge_response !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "challenge_response".');
    }

    const sanitizedUserId = user_id.trim().slice(0, 128);
    const sanitizedDeviceId = device_id.trim().slice(0, 256);
    const sanitizedAppVersion = app_version.trim().slice(0, 32);

    // ── Verify current token ──
    const { data: currentToken } = await supabase
      .from('device_tokens')
      .select('id, user_id, device_id')
      .eq('device_token', device_token)
      .eq('revoked', false)
      .maybeSingle();

    if (!currentToken) {
      return respond(res, 401, null, 'Invalid or revoked device token.');
    }
    if (currentToken.user_id !== sanitizedUserId || currentToken.device_id !== sanitizedDeviceId) {
      return respond(res, 403, null, 'Token does not match user/device.');
    }

    // ── Challenge-Response Verification (fresh proof required for rotation) ──
    const challenge = challengeStore ? challengeStore.get(challenge_id) : null;

    if (!challenge) {
      return respond(res, 403, null, 'Invalid or expired challenge.');
    }
    if (Date.now() > challenge.expires_at) {
      challengeStore.delete(challenge_id);
      return respond(res, 403, null, 'Challenge expired.');
    }
    if (challenge.consumed) {
      return respond(res, 403, null, 'Challenge already consumed.');
    }
    if (challenge.device_id !== sanitizedDeviceId || challenge.user_id !== sanitizedUserId) {
      return respond(res, 403, null, 'Challenge mismatch.');
    }

    challenge.consumed = true;

    const expectedPayload = `${challenge.nonce}${sanitizedDeviceId}${sanitizedAppVersion}`;
    const expected = crypto.createHash('sha256').update(expectedPayload).digest('hex');

    if (expected.length !== challenge_response.length ||
        !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(challenge_response))) {
      return respond(res, 403, null, 'Challenge verification failed.');
    }

    // ── Atomically revoke old token (conditional update prevents double-rotation) ──
    const { data: revokedRows } = await supabase
      .from('device_tokens')
      .update({
        revoked: true,
        revoked_at: new Date().toISOString(),
        revoke_reason: 'token_rotation',
      })
      .eq('id', currentToken.id)
      .eq('revoked', false)
      .select('id');

    if (!revokedRows || revokedRows.length === 0) {
      // Another concurrent rotation already revoked this token
      return respond(res, 409, null, 'Token already rotated by another request. Re-fetch current token.');
    }

    // ── Issue new token ──
    const newToken = crypto.randomBytes(32).toString('hex');

    const { error: insertError } = await supabase
      .from('device_tokens')
      .insert({
        user_id: sanitizedUserId,
        device_id: sanitizedDeviceId,
        device_token: newToken,
      });

    if (insertError) {
      console.error('[/device/rotate] Insert error:', insertError.message);
      return respond(res, 500, null, 'Failed to issue new device token.');
    }

    logEvent(sanitizedUserId, sanitizedDeviceId, 'device_token_rotated', ip, {
      old_token_id: currentToken.id,
    });

    return respond(res, 200, {
      device_token: newToken,
    });

  } catch (err) {
    console.error('[/device/rotate] Unexpected error:', err.message, err.stack);
    return respond(res, 500, null, 'Internal server error.');
  }
});

module.exports = router;
