/**
 * POST /verify/subscription — Authoritative subscription check.
 * Trust middleware enforced — unknown/suspended users blocked before reaching this.
 * Phase 22.3: Anti-abuse hardening.
 *   - trust_score, anomaly_score, effective_trust: INTERNAL ONLY, never in response
 *   - Enriched anomaly metadata
 *   - computeEffectiveScore computed once per request server-side
 *   - Anomaly evaluation on every subscription event
 */
'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabaseClient');
const respond = require('../utils/respond');
const logEvent = require('../utils/logEvent');
const trustCheck = require('../middleware/trustCheck');
const { evaluateUserActivity } = require('../engines/anomalyEngine');

router.post('/verify/subscription', trustCheck, async (req, res) => {
  try {
    const { user_id, device_id } = req.body;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const sanitizedUserId = user_id.trim().slice(0, 128);
    const sanitizedDeviceId = device_id.trim().slice(0, 256);

    // Phase 22.3: Real-time anomaly evaluation with request context
    const anomaly = await evaluateUserActivity(sanitizedUserId, sanitizedDeviceId, {
      ip,
      event_type: 'verify_subscription',
    }, {
      ip,
      headers: req.headers,
      body: req.body,
    });

    // Enforcement: anomaly effectiveScore < 0.4 → force re-verification
    if (anomaly.effectiveScore < 0.4) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'subscription_force_reverify', ip, {
        triggered: anomaly.triggered,
      });
      return respond(res, 200, {
        user_id: sanitizedUserId,
        status: 'reverify_required',
        reason: 'Anomalous activity detected. Subscription must be re-verified.',
        verified_at: new Date().toISOString(),
      });
    }

    // Query subscriptions table for this user
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('status, expires_at, created_at')
      .eq('user_id', sanitizedUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[/verify/subscription] Supabase error:', error.message);
      return respond(res, 500, null, 'Failed to verify subscription.');
    }

    // Log the verification event
    logEvent(sanitizedUserId, device_id, 'verify_subscription', ip);

    // No subscription record → inactive
    if (!subscription) {
      return respond(res, 200, {
        user_id: sanitizedUserId,
        status: 'inactive',
        expires_at: null,
        restricted: req.restricted || false,
        verified_at: new Date().toISOString(),
      });
    }

    // Check if expired
    const isExpired = subscription.expires_at &&
      new Date(subscription.expires_at) < new Date();

    const effectiveStatus = isExpired ? 'expired' : subscription.status;

    return respond(res, 200, {
      user_id: sanitizedUserId,
      status: effectiveStatus,
      expires_at: subscription.expires_at,
      restricted: req.restricted || false,
      verified_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[/verify/subscription] Unexpected error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

module.exports = router;
