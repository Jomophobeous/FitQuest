/**
 * POST /verify/subscription — Authoritative subscription check.
 * Trust middleware enforced — unknown/suspended users blocked before reaching this.
 * Phase 22.2: anomaly evaluation + force re-verify if score > 0.6.
 *             anomaly_score never exposed to client.
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

    // Phase 22.2: Real-time anomaly evaluation
    const anomaly = await evaluateUserActivity(sanitizedUserId, sanitizedDeviceId, {
      ip,
      event_type: 'verify_subscription',
    });

    // Enforcement: anomaly_score > 0.6 → force re-verification
    if (anomaly.anomalyScore > 0.6) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'subscription_force_reverify', ip, {
        anomaly_score: anomaly.anomalyScore,
        triggered: anomaly.triggered,
      });
      return respond(res, 200, {
        user_id: sanitizedUserId,
        status: 'reverify_required',
        reason: 'Anomalous activity detected. Subscription must be re-verified.',
        effective_trust: req.effectiveTrust,
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
        effective_trust: req.effectiveTrust,
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
      effective_trust: req.effectiveTrust,
      verified_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[/verify/subscription] Unexpected error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

module.exports = router;
