/**
 * Subscription routes — Authoritative subscription verification.
 *
 * Phase 31 (Step 4): Server is SINGLE SOURCE OF TRUTH.
 *   - POST /verify/subscription — Check subscription status
 *   - POST /subscriptions/verify — RevenueCat receipt verification
 *   - POST /subscriptions/status — Get authoritative subscription state for client
 *
 * SECURITY:
 *   - trust_score, anomaly_score, effective_trust: INTERNAL ONLY, never in response
 *   - Receipt tokens NEVER logged
 *   - Invalid receipts → 402 Payment Required (not 403)
 *   - No data leakage on denial
 */
'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabaseClient');
const respond = require('../utils/respond');
const logEvent = require('../utils/logEvent');
const trustCheck = require('../middleware/trustCheck');
const { validateDeviceToken } = require('../middleware/validateDeviceToken');
const { evaluateUserActivity } = require('../engines/anomalyEngine');
const { verifyReceipt, postReceipt, clearCache } = require('../utils/revenueCatClient');
const { checkSubscriptionStatus } = require('../middleware/requireSubscription');

router.post('/verify/subscription', validateDeviceToken(), trustCheck, async (req, res) => {
  try {
    const { user_id, device_id } = req.body;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    // trustCheck already validated/sanitized user_id, device_id — use req values
    const sanitizedUserId = req.user.id;
    const sanitizedDeviceId = req.device.device_id;

    // Phase 23: Pass preloaded trust data from trustCheck (P3 optimization — saves 2 DB reads)
    const anomaly = await evaluateUserActivity(sanitizedUserId, sanitizedDeviceId, {
      ip,
      event_type: 'verify_subscription',
    }, {
      ip,
      headers: req.headers,
      body: req.body,
    }, {
      preloadedScores: {
        effectiveScore: req.effectiveTrust,
        trustScore: Number(req.user.trust_score) || 1.0,
        anomalyScore: req.anomalyScore,
      },
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

// ── POST /subscriptions/verify — RevenueCat receipt verification ──
// Client sends receipt_token after purchase → server verifies with RevenueCat
// → updates subscription in Supabase → returns authoritative status.

router.post('/subscriptions/verify', validateDeviceToken(), trustCheck, async (req, res) => {
  try {
    const { user_id, receipt_token, product_id } = req.body;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const sanitizedUserId = req.user?.id || user_id;

    if (!sanitizedUserId) {
      return respond(res, 402, null, 'Payment required.');
    }

    // SECURITY: Never log receipt_token
    logEvent(sanitizedUserId, req.device?.device_id, 'receipt_verify_attempt', ip, {
      product_id: product_id || 'unknown',
    });

    // Tamper detection: user_id in body must match authenticated user
    if (user_id && req.user?.sub && user_id !== req.user.sub) {
      logEvent(sanitizedUserId, req.device?.device_id, 'subscription_tamper_detected', ip, {
        claimed_user: user_id,
        actual_user: req.user.sub,
      });
      return respond(res, 402, null, 'Payment required.');
    }

    let result;

    if (receipt_token && product_id) {
      // Post receipt to RevenueCat for verification
      result = await postReceipt(sanitizedUserId, receipt_token, product_id);
    } else {
      // No receipt — just check current entitlements
      result = await verifyReceipt(sanitizedUserId);
    }

    if (!result.valid) {
      logEvent(sanitizedUserId, req.device?.device_id, 'receipt_verify_failed', ip, {
        source: result.source,
      });
      return respond(res, 402, null, 'Payment required.');
    }

    // Update Supabase subscription record
    if (result.valid && result.source === 'revenuecat') {
      const { error: upsertErr } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: sanitizedUserId,
          status: 'active',
          expires_at: result.expiry,
          plan_type: product_id || 'unknown',
          verified_at: new Date().toISOString(),
          verification_source: 'revenuecat',
        }, { onConflict: 'user_id' });

      if (upsertErr) {
        console.error('[/subscriptions/verify] Upsert error:', upsertErr.message);
      }
    }

    logEvent(sanitizedUserId, req.device?.device_id, 'receipt_verify_success', ip);

    return respond(res, 200, {
      valid: true,
      entitlements: result.entitlements,
      expiry: result.expiry,
      verified_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[/subscriptions/verify] Unexpected error:', err.message);
    return respond(res, 402, null, 'Payment required.');
  }
});

// ── POST /subscriptions/status — Authoritative subscription state for client ──
// Client calls this to get definitive subscription status.
// Returns: { status, expiresAt, hasAccess }
// Client uses this to update its cosmetic UI cache.

router.post('/subscriptions/status', validateDeviceToken(), trustCheck, async (req, res) => {
  try {
    const sanitizedUserId = req.user?.id || req.user?.sub || req.body?.user_id;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    if (!sanitizedUserId) {
      return respond(res, 402, null, 'Payment required.');
    }

    const result = await checkSubscriptionStatus(sanitizedUserId);

    logEvent(sanitizedUserId, req.device?.device_id, 'subscription_status_check', ip, {
      hasAccess: result.hasAccess,
      status: result.status,
    });

    return respond(res, 200, {
      status: result.status,
      has_access: result.hasAccess,
      expires_at: result.expiresAt,
      verified_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[/subscriptions/status] Unexpected error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /subscriptions/attribute — Revenue attribution tracking ──
// Protected: requires JWT. Best-effort attribution data from client.

router.post('/subscriptions/attribute', validateDeviceToken(), trustCheck, async (req, res) => {
  try {
    const sanitizedUserId = req.user?.id || req.user?.sub;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    if (!sanitizedUserId) {
      return respond(res, 401, null, 'Authentication required.');
    }

    const { source, campaign, install_referrer, event_type } = req.body;

    // Upsert attribution record
    const upsertData = {
      user_id: sanitizedUserId,
      updated_at: new Date().toISOString(),
    };

    if (source) upsertData.install_source = source;
    if (campaign) upsertData.install_campaign = campaign;
    if (install_referrer) upsertData.install_referrer = install_referrer;

    // Update lifecycle timestamps based on event type
    if (event_type === 'first_open') {
      upsertData.first_open_at = new Date().toISOString();
    } else if (event_type === 'trial_started') {
      upsertData.trial_started_at = new Date().toISOString();
    } else if (event_type === 'converted') {
      upsertData.converted_at = new Date().toISOString();
    } else if (event_type === 'churned') {
      upsertData.churn_at = new Date().toISOString();
    }

    const { error: upsertErr } = await supabase
      .from('user_attribution')
      .upsert(upsertData, { onConflict: 'user_id' });

    if (upsertErr) {
      console.error('[/subscriptions/attribute] Upsert error:', upsertErr.message);
      return respond(res, 500, null, 'Failed to store attribution.');
    }

    logEvent(sanitizedUserId, req.device?.device_id, 'attribution_update', ip, {
      source, campaign, event_type,
    });

    return respond(res, 200, { stored: true });
  } catch (err) {
    console.error('[/subscriptions/attribute] Unexpected error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

module.exports = router;
