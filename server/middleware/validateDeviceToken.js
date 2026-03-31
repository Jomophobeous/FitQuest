/**
 * Phase 26 — Device Token Validation Middleware
 *
 * Validates that every protected request carries a valid, non-revoked
 * device_token that matches the claimed user_id + device_id.
 *
 * Attaches to request:
 *   req.deviceTokenRecord — full token row (for downstream use)
 *
 * Rejection:
 *   401 — missing or invalid token
 *   403 — token/user/device mismatch, or token revoked
 */
'use strict';

const supabase = require('../utils/supabaseClient');
const respond = require('../utils/respond');
const logEvent = require('../utils/logEvent');

/**
 * Middleware factory. Validates device_token from req.body.
 * Expects: { user_id, device_id, device_token } in request body.
 */
function validateDeviceToken() {
  return async (req, res, next) => {
    try {
      const { user_id, device_id, device_token } = req.body;

      // ── Require token ──
      if (!device_token || typeof device_token !== 'string') {
        return respond(res, 401, null, 'Missing device_token. Register device first via /device/register.');
      }

      if (!user_id || typeof user_id !== 'string') {
        return respond(res, 400, null, 'Missing or invalid "user_id".');
      }
      if (!device_id || typeof device_id !== 'string') {
        return respond(res, 400, null, 'Missing or invalid "device_id".');
      }

      const sanitizedUserId = user_id.trim().slice(0, 128);
      const sanitizedDeviceId = device_id.trim().slice(0, 256);

      // ── Look up token ──
      const { data: tokenRecord, error } = await supabase
        .from('device_tokens')
        .select('id, user_id, device_id, device_token, revoked, created_at, last_seen')
        .eq('device_token', device_token)
        .maybeSingle();

      if (error) {
        console.error('[validateDeviceToken] DB error:', error.message);
        return respond(res, 500, null, 'Internal server error.');
      }

      if (!tokenRecord) {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        logEvent(sanitizedUserId, sanitizedDeviceId, 'device_token_unknown', ip);
        return respond(res, 401, null, 'Unknown device token. Register device first.');
      }

      // ── Check revoked ──
      if (tokenRecord.revoked) {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        logEvent(sanitizedUserId, sanitizedDeviceId, 'device_token_revoked_access', ip, {
          token_id: tokenRecord.id,
        });
        return respond(res, 403, null, 'Device token has been revoked.');
      }

      // ── Verify user + device match ──
      if (tokenRecord.user_id !== sanitizedUserId) {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        logEvent(sanitizedUserId, sanitizedDeviceId, 'device_token_user_mismatch', ip, {
          token_user: tokenRecord.user_id,
          claimed_user: sanitizedUserId,
        });
        return respond(res, 403, null, 'Device token does not match user.');
      }

      if (tokenRecord.device_id !== sanitizedDeviceId) {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        logEvent(sanitizedUserId, sanitizedDeviceId, 'device_token_device_mismatch', ip, {
          token_device: tokenRecord.device_id,
          claimed_device: sanitizedDeviceId,
        });
        return respond(res, 403, null, 'Device token does not match device.');
      }

      // ── Attach to request ──
      req.deviceTokenRecord = tokenRecord;

      // ── Update last_seen (fire-and-forget) ──
      supabase
        .from('device_tokens')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', tokenRecord.id)
        .then(() => {})
        .catch(() => {});

      next();
    } catch (err) {
      console.error('[validateDeviceToken] Unexpected error:', err.message);
      return respond(res, 500, null, 'Internal server error.');
    }
  };
}

module.exports = { validateDeviceToken };
