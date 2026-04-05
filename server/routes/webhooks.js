/**
 * RevenueCat Webhook Handler
 *
 * POST /subscriptions/webhook — receives RevenueCat server notifications.
 * Public route (no JWT) — authenticated via REVENUECAT_WEBHOOK_SECRET header.
 * Returns 200 immediately; processes asynchronously where possible.
 */
'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const supabase = require('../utils/supabaseClient');
const respond = require('../utils/respond');

const WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET;

const SUPPORTED_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'CANCELLATION',
  'EXPIRATION',
  'BILLING_ISSUE',
  'PRODUCT_CHANGE',
]);

/**
 * Map RevenueCat event type to subscription status.
 */
function eventToStatus(eventType) {
  switch (eventType) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
      return 'active';
    case 'CANCELLATION':
      return 'cancelled';
    case 'EXPIRATION':
      return 'expired';
    case 'BILLING_ISSUE':
      return 'billing_issue';
    case 'PRODUCT_CHANGE':
      return 'active';
    default:
      return null;
  }
}

router.post('/subscriptions/webhook', async (req, res) => {
  // Respond immediately — RevenueCat requires fast 200
  res.status(200).json({ ok: true });

  try {
    // Validate webhook secret
    const authHeader = req.headers['authorization'] || '';
    if (!WEBHOOK_SECRET || !authHeader) {
      console.error('[webhook] Missing authorization or secret not configured');
      return;
    }

    // Simple bearer comparison (constant-time)
    const providedSecret = authHeader.replace(/^Bearer\s+/i, '');
    const isValid = crypto.timingSafeEqual(
      Buffer.from(providedSecret, 'utf8'),
      Buffer.from(WEBHOOK_SECRET, 'utf8'),
    );

    if (!isValid) {
      console.error('[webhook] Invalid authorization header');
      return;
    }

    const { event } = req.body || {};
    if (!event) {
      console.error('[webhook] No event in payload');
      return;
    }

    const eventType = event.type;
    const appUserId = event.app_user_id;
    const productId = event.product_id;
    const priceUsd = event.price_in_purchased_currency != null
      ? Number(event.price_in_purchased_currency)
      : null;
    const currency = event.currency || 'USD';
    const entitlement = event.entitlement_ids?.[0] || null;
    const expiresAt = event.expiration_at_ms
      ? new Date(event.expiration_at_ms).toISOString()
      : null;

    if (!SUPPORTED_EVENTS.has(eventType)) {
      console.log(`[webhook] Ignoring unsupported event: ${eventType}`);
      return;
    }

    if (!appUserId) {
      console.error('[webhook] No app_user_id in event');
      return;
    }

    // Log to revenue_events
    const { error: logErr } = await supabase
      .from('revenue_events')
      .insert({
        user_id: appUserId,
        event_type: eventType,
        product_id: productId,
        revenue_usd: priceUsd,
        currency,
        entitlement,
        expires_at: expiresAt,
        raw_payload: event,
      });

    if (logErr) {
      console.error('[webhook] Failed to log revenue event:', logErr.message);
    }

    // Update subscription status
    const newStatus = eventToStatus(eventType);
    if (newStatus && appUserId) {
      const { error: upsertErr } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: appUserId,
          status: newStatus,
          plan_type: productId || 'unknown',
          expires_at: expiresAt,
          verified_at: new Date().toISOString(),
          verification_source: 'revenuecat_webhook',
        }, { onConflict: 'user_id' });

      if (upsertErr) {
        console.error('[webhook] Failed to update subscription:', upsertErr.message);
      }
    }

    console.log(`[webhook] Processed ${eventType} for ${appUserId}`);
  } catch (err) {
    console.error('[webhook] Unexpected error:', err.message);
  }
});

module.exports = router;
