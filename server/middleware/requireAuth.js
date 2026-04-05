/**
 * JWT Validation Middleware — Server-side token enforcement.
 *
 * ENFORCEMENT: Every protected route MUST pass through this middleware.
 * No unguarded paths. No silent failures.
 *
 * - Validates HS256 JWTs signed by the authority server
 * - Checks signature, expiry, issuer, audience, type
 * - Sets req.user = { sub, email, type } for downstream use
 * - Invalid/expired/missing → 401 (no leak of details)
 *
 * Public routes (health, auth endpoints) are exempt.
 */
'use strict';

const respond = require('../utils/respond');
const logEvent = require('../utils/logEvent');
const { verifyAccessToken } = require('../utils/tokenService');

// Routes that do NOT require authentication
const PUBLIC_ROUTES = new Set([
  '/health',
  '/auth/email/register',
  '/auth/email/login',
  '/auth/google',
  '/auth/apple',
  '/auth/refresh',
  '/auth/logout',
  '/user/create',
  '/subscriptions/webhook',
]);

/**
 * JWT validation middleware.
 * Extracts Bearer token, verifies signature + claims.
 * Sets req.user on success.
 */
function requireAuth() {
  return (req, res, next) => {
    // Public routes are exempt
    if (PUBLIC_ROUTES.has(req.path)) return next();

    // GET /health is always public
    if (req.method === 'GET' && req.path === '/health') return next();

    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const ip = req.ip || req.connection?.remoteAddress || 'unknown';
      logEvent(null, null, 'auth_missing_token', ip, { path: req.path });
      return respond(res, 401, null, 'Authentication required.');
    }

    const token = authHeader.slice(7);

    try {
      const decoded = verifyAccessToken(token);
      // Attach user info for downstream routes
      req.user = decoded;
      next();
    } catch (err) {
      const ip = req.ip || req.connection?.remoteAddress || 'unknown';
      
      // Distinguish expired vs invalid for logging (NOT for the response)
      const reason = err.name === 'TokenExpiredError' ? 'expired' : 'invalid';
      logEvent(null, null, `auth_token_${reason}`, ip, { path: req.path });

      // Always return 401 — no detail leakage
      return respond(res, 401, null, 'Invalid or expired token.');
    }
  };
}

module.exports = { requireAuth };
