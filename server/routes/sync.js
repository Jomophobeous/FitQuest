/**
 * Phase 25B/26 — Batch Sync Endpoint
 *
 * POST /sync/batch — Receive queued offline actions, validate via challenge-response
 * AND device_token, process each action, return per-action results + authoritative XP.
 *
 * Flow:
 *   1. Client acquires challenge (POST /auth/challenge)
 *   2. Client computes response: SHA-256(nonce + device_id + app_version)
 *   3. Client sends POST /sync/batch with actions + challenge proof + device_token
 *   4. Middleware validates device_token (user + device binding)
 *   5. Server validates challenge, processes each action, returns results
 *
 * Server is FINAL AUTHORITY on XP and subscription.
 */
'use strict';

const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabaseClient');
const respond = require('../utils/respond');
const logEvent = require('../utils/logEvent');
const { validateDeviceToken } = require('../middleware/validateDeviceToken');

// Import the challenge store from auth route (shared in-memory)
// Note: For the sync endpoint, we use the same challenge-response mechanism
// but validate inline rather than importing the store directly (encapsulation).

// ── Constants ──

const MAX_BATCH_SIZE = 50;
const CHALLENGE_TTL_MS = 60 * 1000;

// Challenge store — shared with auth route (same in-memory Map)
const authRouter = require('./auth');
const challengeStore = authRouter._challengeStore;

// ── Allowed Action Types ──

const ALLOWED_ACTIONS = new Set([
  'workout_complete',
  'xp_earn',
  'step_log',
  'jog_log',
  'progress_photo',
  'streak_update',
]);

// Actions that affect XP (server recalculates)
const XP_ACTIONS = new Set([
  'workout_complete',
  'xp_earn',
  'step_log',
  'jog_log',
  'progress_photo',
]);

// ── POST /sync/batch ──

router.post('/sync/batch', validateDeviceToken(), async (req, res) => {
  try {
    const { user_id, device_id, app_version, challenge_id, challenge_response, actions } = req.body;
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
    if (!Array.isArray(actions) || actions.length === 0) {
      return respond(res, 400, null, 'Missing or empty "actions" array.');
    }
    if (actions.length > MAX_BATCH_SIZE) {
      return respond(res, 400, null, `Batch too large. Max ${MAX_BATCH_SIZE} actions.`);
    }

    const sanitizedUserId = user_id.trim().slice(0, 128);
    const sanitizedDeviceId = device_id.trim().slice(0, 256);
    const sanitizedAppVersion = app_version.trim().slice(0, 32);

    // ── Challenge-Response Verification ──

    const challenge = challengeStore ? challengeStore.get(challenge_id) : null;

    if (!challenge) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'sync_challenge_invalid', ip, {
        challenge_id,
      });
      return respond(res, 403, null, 'Invalid or expired challenge.');
    }

    if (Date.now() > challenge.expires_at) {
      challengeStore.delete(challenge_id);
      return respond(res, 403, null, 'Challenge expired.');
    }

    if (challenge.consumed) {
      return respond(res, 403, null, 'Challenge already consumed.');
    }

    // Verify device_id matches challenge
    if (challenge.device_id !== sanitizedDeviceId) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'sync_device_mismatch', ip, {
        challenge_id,
        expected_device: challenge.device_id,
      });
      return respond(res, 403, null, 'Device mismatch.');
    }

    // Verify user_id matches challenge
    if (challenge.user_id !== sanitizedUserId) {
      return respond(res, 403, null, 'User mismatch.');
    }

    // Mark consumed BEFORE validation (prevent race)
    challenge.consumed = true;

    // Reconstruct expected response: SHA-256(nonce + device_id + app_version)
    const expectedPayload = `${challenge.nonce}${sanitizedDeviceId}${sanitizedAppVersion}`;
    const expected = crypto.createHash('sha256').update(expectedPayload).digest('hex');

    if (expected.length !== challenge_response.length ||
        !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(challenge_response))) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'sync_auth_failed', ip, {
        challenge_id,
      });
      return respond(res, 403, null, 'Challenge verification failed.');
    }

    // ── Process Actions ──

    const results = [];
    let xpDelta = 0;

    for (const action of actions) {
      const result = processAction(action, sanitizedUserId, sanitizedDeviceId);
      results.push(result);
      if (result.status === 'accepted' && XP_ACTIONS.has(action.type)) {
        xpDelta += result.xp_awarded || 0;
      }
    }

    // ── Fetch Authoritative State ──

    let serverXP = 0;
    let subscriptionStatus = 'inactive';

    try {
      // Get current server-side XP (or create default)
      const { data: userData } = await supabase
        .from('user_profiles')
        .select('total_xp, subscription_status')
        .eq('user_id', sanitizedUserId)
        .single();

      if (userData) {
        // Apply XP delta from accepted actions
        const newXP = (userData.total_xp || 0) + xpDelta;
        serverXP = newXP;

        // Update server XP if changed
        if (xpDelta > 0) {
          await supabase
            .from('user_profiles')
            .update({ total_xp: newXP, updated_at: new Date().toISOString() })
            .eq('user_id', sanitizedUserId);
        }

        subscriptionStatus = userData.subscription_status || 'inactive';
      } else {
        // User not in server DB — use XP from accepted actions only
        serverXP = xpDelta;
      }
    } catch (dbErr) {
      // DB error: still return results, use 0 XP fallback
      console.error('[/sync/batch] DB error fetching user state:', dbErr.message);
    }

    // ── Log Sync Event ──

    const acceptedCount = results.filter(r => r.status === 'accepted').length;
    const rejectedCount = results.filter(r => r.status === 'rejected').length;

    logEvent(sanitizedUserId, sanitizedDeviceId, 'sync_batch_processed', ip, {
      total_actions: actions.length,
      accepted: acceptedCount,
      rejected: rejectedCount,
      xp_delta: xpDelta,
      server_xp: serverXP,
    });

    return respond(res, 200, {
      results,
      server_xp: serverXP,
      subscription_status: subscriptionStatus,
      synced_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[/sync/batch] Unexpected error:', err.message, err.stack);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── Action Processor ──

/**
 * Process a single queued action. Returns { action_id, status, reason, xp_awarded }.
 * Server validates action integrity — rejects impossible values.
 */
function processAction(action, userId, deviceId) {
  const { action_id, type, payload } = action;

  // Basic structural validation
  if (!action_id || typeof action_id !== 'string') {
    return { action_id: action_id || 'unknown', status: 'rejected', reason: 'Missing action_id' };
  }
  if (!type || !ALLOWED_ACTIONS.has(type)) {
    return { action_id, status: 'rejected', reason: `Unknown or blocked action type: ${type}` };
  }
  if (!payload || typeof payload !== 'object') {
    return { action_id, status: 'rejected', reason: 'Missing or invalid payload' };
  }

  // Type-specific validation
  switch (type) {
    case 'workout_complete':
      return processWorkoutComplete(action_id, payload);
    case 'xp_earn':
      return processXPEarn(action_id, payload);
    case 'step_log':
      return processStepLog(action_id, payload);
    case 'jog_log':
      return processJogLog(action_id, payload);
    case 'progress_photo':
      return processProgressPhoto(action_id, payload);
    case 'streak_update':
      return processStreakUpdate(action_id, payload);
    default:
      return { action_id, status: 'rejected', reason: 'Unhandled action type' };
  }
}

function processWorkoutComplete(actionId, payload) {
  const { completed_exercises, total_exercises, duration_minutes, streak_days } = payload;

  // Sanity checks — reject impossible values
  if (typeof completed_exercises !== 'number' || completed_exercises < 0 || completed_exercises > 100) {
    return { action_id: actionId, status: 'rejected', reason: 'Invalid completed_exercises' };
  }
  if (typeof total_exercises !== 'number' || total_exercises < 1 || total_exercises > 100) {
    return { action_id: actionId, status: 'rejected', reason: 'Invalid total_exercises' };
  }
  if (completed_exercises > total_exercises) {
    return { action_id: actionId, status: 'rejected', reason: 'completed > total exercises' };
  }
  if (typeof duration_minutes !== 'number' || duration_minutes < 0 || duration_minutes > 480) {
    return { action_id: actionId, status: 'rejected', reason: 'Invalid duration (max 8h)' };
  }

  // Server recalculates XP (never trusts client XP values)
  const baseXP = 100;
  const exerciseXP = completed_exercises * 20;
  const completionBonus = completed_exercises >= total_exercises ? 50 : 0;
  const streakBonus = Math.min(streak_days || 0, 365) * 10;
  const xpAwarded = baseXP + exerciseXP + completionBonus + streakBonus;

  return { action_id: actionId, status: 'accepted', reason: 'ok', xp_awarded: xpAwarded };
}

function processXPEarn(actionId, payload) {
  const { amount, source } = payload;

  if (typeof amount !== 'number' || amount <= 0 || amount > 10000) {
    return { action_id: actionId, status: 'rejected', reason: 'Invalid XP amount' };
  }

  // Cap arbitrary XP claims
  const cappedAmount = Math.min(amount, 500);
  return { action_id: actionId, status: 'accepted', reason: 'ok', xp_awarded: cappedAmount };
}

function processStepLog(actionId, payload) {
  const { steps, date } = payload;

  if (typeof steps !== 'number' || steps < 0 || steps > 200000) {
    return { action_id: actionId, status: 'rejected', reason: 'Invalid step count' };
  }

  // 4 XP per 1000 steps
  const xpAwarded = Math.floor(steps / 1000) * 4;
  return { action_id: actionId, status: 'accepted', reason: 'ok', xp_awarded: xpAwarded };
}

function processJogLog(actionId, payload) {
  const { distance_meters, duration_minutes } = payload;

  if (typeof distance_meters !== 'number' || distance_meters < 0 || distance_meters > 100000) {
    return { action_id: actionId, status: 'rejected', reason: 'Invalid distance' };
  }

  // 10 XP per 100m
  const xpAwarded = Math.max(Math.floor(distance_meters / 100) * 10, 1);
  return { action_id: actionId, status: 'accepted', reason: 'ok', xp_awarded: xpAwarded };
}

function processProgressPhoto(actionId, _payload) {
  // Always accept, flat XP
  return { action_id: actionId, status: 'accepted', reason: 'ok', xp_awarded: 25 };
}

function processStreakUpdate(actionId, payload) {
  const { current_streak, last_workout_date } = payload;

  if (typeof current_streak !== 'number' || current_streak < 0 || current_streak > 3650) {
    return { action_id: actionId, status: 'rejected', reason: 'Invalid streak value' };
  }

  // Streak updates don't directly award XP (XP comes from workout completion)
  return { action_id: actionId, status: 'accepted', reason: 'ok', xp_awarded: 0 };
}

module.exports = router;
