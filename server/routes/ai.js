/**
 * AI governance route — Phase 22.3.
 *
 * POST /ai/request
 *   - trustCheck middleware enforces trust thresholds
 *   - Per-user rate limiting (20 req / 15 min)
 *   - Real-time anomaly evaluation on every request
 *   - Enforcement:
 *       effectiveScore < 0.3   → blocked (trustCheck 403)
 *       effectiveScore < 0.5   → restricted (degraded access)
 *       anomalyScore > 0.6     → AI blocked at route level
 *   - trust_score, anomaly_score, effectiveTrust: INTERNAL ONLY, never in response
 *   - Usage logged to events + ai_usage (prompt_length, device_id, timestamp)
 *   - computeEffectiveScore applied server-side before any response
 */
'use strict';

const { Router } = require('express');
const trustCheck = require('../middleware/trustCheck');
const supabase = require('../utils/supabaseClient');
const logEvent = require('../utils/logEvent');
const respond = require('../utils/respond');
const { evaluateUserActivity } = require('../engines/anomalyEngine');

const router = Router();

// ── Per-user AI rate limiting ──
const AI_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const AI_RATE_LIMIT_MAX = 20;
const aiRateMap = new Map();

// Periodic cleanup (every 10 min)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of aiRateMap) {
    if (now - entry.windowStart > AI_RATE_LIMIT_WINDOW_MS * 2) {
      aiRateMap.delete(key);
    }
  }
}, 10 * 60 * 1000);

/**
 * Check per-user/device AI rate limit.
 * Returns { allowed, remaining, retryAfterMs }.
 */
function checkAIRateLimit(userId, deviceId) {
  const key = `${userId}::${deviceId}`;
  const now = Date.now();

  if (!aiRateMap.has(key)) {
    aiRateMap.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: AI_RATE_LIMIT_MAX - 1, retryAfterMs: 0 };
  }

  const entry = aiRateMap.get(key);
  if (now - entry.windowStart > AI_RATE_LIMIT_WINDOW_MS) {
    // Window expired — reset
    entry.count = 1;
    entry.windowStart = now;
    return { allowed: true, remaining: AI_RATE_LIMIT_MAX - 1, retryAfterMs: 0 };
  }

  entry.count += 1;
  if (entry.count > AI_RATE_LIMIT_MAX) {
    const retryAfterMs = AI_RATE_LIMIT_WINDOW_MS - (now - entry.windowStart);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  return { allowed: true, remaining: AI_RATE_LIMIT_MAX - entry.count, retryAfterMs: 0 };
}

// ── POST /ai/request ──

router.post('/ai/request', trustCheck, async (req, res) => {
  const { user_id, device_id, prompt } = req.body;
  const ip = req.ip || req.connection.remoteAddress || 'unknown';

  // Validate prompt
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return respond(res, 400, null, 'Missing or empty "prompt" field.');
  }

  const sanitizedPrompt = prompt.trim().slice(0, 4000);
  // trustCheck already validated/sanitized user_id, device_id — use req values
  const sanitizedUserId = req.user.id;
  const sanitizedDeviceId = req.device.device_id;

  // ── Per-user rate limit ──
  const rl = checkAIRateLimit(sanitizedUserId, sanitizedDeviceId);
  if (!rl.allowed) {
    logEvent(sanitizedUserId, sanitizedDeviceId, 'ai_rate_limited', ip);
    return respond(res, 429, {
      restricted: true,
      retryAfterMs: rl.retryAfterMs,
    }, 'AI rate limit exceeded. Try again later.');
  }

  // ── Trust-based AI access ──
  // trustCheck already blocks < 0.3 (403) and sets req.restricted for < 0.5
  const restricted = req.restricted || false;

  // Phase 23: Pass preloaded trust data from trustCheck (P3 optimization — saves 2 DB reads)
  const anomaly = await evaluateUserActivity(sanitizedUserId, sanitizedDeviceId, {
    ip,
    event_type: 'ai_request',
    prompt_length: sanitizedPrompt.length,
  }, {
    ip,
    headers: req.headers,
    body: { user_id: sanitizedUserId, device_id: sanitizedDeviceId, prompt_length: sanitizedPrompt.length },
  }, {
    preloadedScores: {
      effectiveScore: req.effectiveTrust,
      trustScore: Number(req.user.trust_score) || 1.0,
      anomalyScore: req.anomalyScore,
    },
  });

  // Enforcement: anomalyScore > 0.6 → block AI entirely
  if (anomaly.anomalyScore > 0.6) {
    logEvent(sanitizedUserId, sanitizedDeviceId, 'ai_blocked_anomaly', ip, {
      triggered: anomaly.triggered,
    });
    return respond(res, 403, {
      authorized: false,
      reason: 'AI access suspended due to anomalous activity.',
    });
  }

  // Enforcement: effectiveScore < 0.5 → restricted
  if (restricted || anomaly.effectiveScore < 0.5) {
    logEvent(sanitizedUserId, sanitizedDeviceId, 'ai_access_restricted', ip);
    return respond(res, 200, {
      authorized: false,
      restricted: true,
      reason: 'AI features are restricted due to trust score.',
      remaining: rl.remaining,
    });
  }

  // ── Log usage ──
  logEvent(sanitizedUserId, sanitizedDeviceId, 'ai_request', ip);

  // Phase 23: ai_usage logging (fire-and-forget with error logging)
  supabase.from('ai_usage').insert({
    user_id: sanitizedUserId,
    device_id: sanitizedDeviceId,
    prompt_length: sanitizedPrompt.length,
  }).then(({ error }) => {
    if (error) console.error('[ai] ai_usage insert error:', error.message);
  }).catch((err) => {
    console.error('[ai] ai_usage insert exception:', err.message);
  });

  // Phase 22.3: ALL internal scores hidden — authorized response only
  return respond(res, 200, {
    authorized: true,
    restricted: false,
    remaining: rl.remaining,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
