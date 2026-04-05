/**
 * RevenueCat Server-Side Client — Receipt verification & entitlement checks.
 *
 * Uses RevenueCat REST API v1 to verify subscriptions server-side.
 * Server is the SINGLE SOURCE OF TRUTH for subscription status.
 *
 * SECURITY:
 * - Never log receipt tokens or API keys
 * - Cache results for 5 min to reduce API calls
 * - Graceful degradation when RevenueCat API is down
 */
'use strict';

const REVENUECAT_API_KEY = process.env.REVENUECAT_API_SECRET_KEY;
const REVENUECAT_API_URL = 'https://api.revenuecat.com/v1';
const ENTITLEMENT_ID = 'full_access';

// ── In-memory cache (5-min TTL) ──
const subscriptionCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verify a user's subscription via RevenueCat REST API.
 * @param {string} userId - RevenueCat app_user_id
 * @returns {{ valid: boolean, entitlements: string[], expiry: string|null, source: string }}
 */
async function verifyReceipt(userId) {
  if (!userId || typeof userId !== 'string') {
    return { valid: false, entitlements: [], expiry: null, source: 'invalid_input' };
  }

  // Check cache first
  const cached = subscriptionCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { ...cached.result, source: 'cache' };
  }

  // No API key configured — cannot verify
  if (!REVENUECAT_API_KEY) {
    return { valid: false, entitlements: [], expiry: null, source: 'no_api_key' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${REVENUECAT_API_URL}/subscribers/${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${REVENUECAT_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Platform': 'android',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      // RevenueCat API error — fall back to cache if available
      if (cached) {
        return { ...cached.result, source: 'stale_cache' };
      }
      return { valid: false, entitlements: [], expiry: null, source: 'api_error' };
    }

    const data = await res.json();
    const subscriber = data?.subscriber;
    if (!subscriber) {
      return { valid: false, entitlements: [], expiry: null, source: 'no_subscriber' };
    }

    // Check entitlements
    const entitlements = subscriber.entitlements || {};
    const activeEntitlements = [];
    let latestExpiry = null;

    for (const [key, ent] of Object.entries(entitlements)) {
      const expiresDate = ent.expires_date ? new Date(ent.expires_date) : null;
      if (expiresDate && expiresDate > new Date()) {
        activeEntitlements.push(key);
        if (!latestExpiry || expiresDate > new Date(latestExpiry)) {
          latestExpiry = ent.expires_date;
        }
      }
      // Lifetime / no expiry
      if (!ent.expires_date && ent.purchase_date) {
        activeEntitlements.push(key);
      }
    }

    const hasAccess = activeEntitlements.includes(ENTITLEMENT_ID) || activeEntitlements.length > 0;

    const result = {
      valid: hasAccess,
      entitlements: activeEntitlements,
      expiry: latestExpiry,
      source: 'revenuecat',
    };

    // Update cache
    subscriptionCache.set(userId, { result, timestamp: Date.now() });

    return result;
  } catch (err) {
    // Network error / timeout — fall back to cache
    if (cached) {
      return { ...cached.result, source: 'stale_cache' };
    }
    return { valid: false, entitlements: [], expiry: null, source: 'network_error' };
  }
}

/**
 * Post a receipt to RevenueCat for verification.
 * @param {string} userId - RevenueCat app_user_id
 * @param {string} receiptToken - Google Play / App Store receipt
 * @param {string} productId - Product identifier
 * @returns {{ valid: boolean, entitlements: string[], expiry: string|null }}
 */
async function postReceipt(userId, receiptToken, productId) {
  if (!userId || !receiptToken || !productId) {
    return { valid: false, entitlements: [], expiry: null, source: 'invalid_input' };
  }

  if (!REVENUECAT_API_KEY) {
    return { valid: false, entitlements: [], expiry: null, source: 'no_api_key' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${REVENUECAT_API_URL}/receipts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REVENUECAT_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Platform': 'android',
      },
      body: JSON.stringify({
        app_user_id: userId,
        fetch_token: receiptToken,
        product_id: productId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return { valid: false, entitlements: [], expiry: null, source: 'receipt_rejected' };
    }

    // After posting receipt, verify the updated subscriber state
    return verifyReceipt(userId);
  } catch {
    return { valid: false, entitlements: [], expiry: null, source: 'network_error' };
  }
}

/**
 * Clear cached subscription for a user (e.g., after purchase or on webhook).
 */
function clearCache(userId) {
  subscriptionCache.delete(userId);
}

/**
 * Periodic cache cleanup — remove entries older than 2x TTL.
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of subscriptionCache) {
    if (now - entry.timestamp > CACHE_TTL_MS * 2) {
      subscriptionCache.delete(key);
    }
  }
}, CACHE_TTL_MS);

module.exports = { verifyReceipt, postReceipt, clearCache };
