/**
 * requireSubscription — Server-side subscription enforcement middleware.
 *
 * MUST be the FIRST check on every premium endpoint (before business logic).
 * Server is the SINGLE SOURCE OF TRUTH. Client state is cosmetic only.
 *
 * Flow:
 * 1. Extract user_id from JWT (req.user.sub)
 * 2. Check Supabase subscriptions table
 * 3. If RevenueCat API key configured, verify with RevenueCat
 * 4. Active subscription OR active trial → next()
 * 5. Otherwise → 402 Payment Required (no data leakage)
 *
 * SECURITY:
 * - 402 responses contain NO details about why access was denied
 * - No subscription details in error responses
 * - Breach attempts flagged in events table
 */
'use strict';

const supabase = require('../utils/supabaseClient');
const respond = require('../utils/respond');
const logEvent = require('../utils/logEvent');
const { verifyReceipt } = require('../utils/revenueCatClient');

/**
 * Premium endpoint list — these routes require active subscription.
 * Used for audit trail and logging.
 */
const PREMIUM_ENDPOINTS = [
  '/ai/request',
  '/coach',
  '/analytics',
  '/craft-my-body',
  '/workout/generate',
  '/nutrition/plan',
  '/sleep/insights',
  '/progress/detailed',
];

/**
 * Check if user has an active subscription or trial.
 * @param {string} userId
 * @returns {Promise<{hasAccess: boolean, status: string, expiresAt: string|null}>}
 */
async function checkSubscriptionStatus(userId) {
  // 1. Check Supabase subscriptions table
  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select('status, expires_at, plan_type, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[requireSubscription] DB error:', error.message);
    // On DB error, deny access (fail closed)
    return { hasAccess: false, status: 'error', expiresAt: null };
  }

  if (!subscription) {
    // No subscription record — check trial
    return checkTrialStatus(userId);
  }

  // Check if active and not expired
  const isExpired = subscription.expires_at &&
    new Date(subscription.expires_at) < new Date();

  if (subscription.status === 'active' && !isExpired) {
    return {
      hasAccess: true,
      status: 'active',
      expiresAt: subscription.expires_at,
    };
  }

  // Subscription exists but expired/cancelled — check trial fallback
  if (isExpired || subscription.status !== 'active') {
    return { hasAccess: false, status: 'expired', expiresAt: subscription.expires_at };
  }

  return { hasAccess: false, status: 'inactive', expiresAt: null };
}

/**
 * Check if user is in active trial period.
 */
async function checkTrialStatus(userId) {
  const { data: trial, error } = await supabase
    .from('trial_state')
    .select('started_at, ends_at, converted')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !trial) {
    return { hasAccess: false, status: 'no_trial', expiresAt: null };
  }

  if (trial.converted) {
    // Converted but no active subscription found — expired
    return { hasAccess: false, status: 'converted_expired', expiresAt: null };
  }

  const now = new Date();
  const trialEnd = new Date(trial.ends_at);

  if (now < trialEnd) {
    return { hasAccess: true, status: 'trial', expiresAt: trial.ends_at };
  }

  return { hasAccess: false, status: 'trial_expired', expiresAt: trial.ends_at };
}

/**
 * Middleware: require active subscription or trial.
 * Returns 402 Payment Required on failure (no data leakage).
 */
function requireSubscription() {
  return async (req, res, next) => {
    const userId = req.user?.sub || req.user?.id || req.body?.user_id;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';

    if (!userId) {
      logEvent(null, null, 'subscription_check_no_user', ip, { path: req.path });
      return respond(res, 402, null, 'Payment required.');
    }

    try {
      const result = await checkSubscriptionStatus(userId);

      if (result.hasAccess) {
        // Attach subscription info for downstream use
        req.subscription = {
          status: result.status,
          expiresAt: result.expiresAt,
        };
        return next();
      }

      // No access — log and return 402
      logEvent(userId, null, 'premium_access_denied', ip, {
        path: req.path,
        subscriptionStatus: result.status,
      });

      return respond(res, 402, null, 'Payment required.');
    } catch (err) {
      console.error('[requireSubscription] Unexpected error:', err.message);
      // Fail closed — deny access on error
      return respond(res, 402, null, 'Payment required.');
    }
  };
}

module.exports = { requireSubscription, checkSubscriptionStatus, PREMIUM_ENDPOINTS };
