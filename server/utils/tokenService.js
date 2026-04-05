/**
 * Token Service — JWT lifecycle management.
 *
 * - Access tokens: 15-minute HS256 JWTs
 * - Refresh tokens: 30-day opaque tokens with family tracking
 * - Token rotation: each refresh invalidates the previous token
 * - Reuse detection: second use of a consumed token → revoke entire family
 * - Revocation list checked before honoring any refresh
 *
 * ZERO shortcuts. Production-ready.
 */
'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const supabase = require('./supabaseClient');
const logEvent = require('./logEvent');

// ── Configuration ──

const ACCESS_TOKEN_EXPIRY = '15m';
const ACCESS_TOKEN_EXPIRY_SECONDS = 900; // 15 minutes
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const REFRESH_TOKEN_BYTES = 48; // 384-bit entropy

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured and at least 32 characters.');
  }
  return secret;
}

// ── Access Token ──

/**
 * Sign a short-lived access token (15 minutes).
 * Payload: { sub: userId, email, type: 'access' }
 */
function signAccessToken(userId, email) {
  if (!userId || !email) throw new Error('userId and email required for access token');
  return jwt.sign(
    { sub: userId, email, type: 'access' },
    getJwtSecret(),
    {
      algorithm: 'HS256',
      expiresIn: ACCESS_TOKEN_EXPIRY,
      issuer: 'fitquest-authority',
      audience: 'fitquest-app',
    }
  );
}

/**
 * Verify an access token. Returns decoded payload or throws.
 * Checks: signature, expiry, issuer, audience, type.
 */
function verifyAccessToken(token) {
  if (!token || typeof token !== 'string') {
    throw new jwt.JsonWebTokenError('Missing or invalid token');
  }
  const decoded = jwt.verify(token, getJwtSecret(), {
    algorithms: ['HS256'],
    issuer: 'fitquest-authority',
    audience: 'fitquest-app',
  });
  if (decoded.type !== 'access') {
    throw new jwt.JsonWebTokenError('Token type mismatch: expected access');
  }
  return decoded;
}

// ── Refresh Token ──

/**
 * Generate a cryptographically random refresh token.
 * Returns: { token, familyId, expiresAt }
 *
 * familyId groups tokens from the same login session.
 * When rotating, the new token inherits the family.
 */
function generateRefreshToken(familyId = null) {
  const token = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  const family = familyId || crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  return { token, familyId: family, expiresAt };
}

/**
 * Store a refresh token in the database.
 * Fields: token_hash, user_id, family_id, expires_at, consumed, revoked
 */
async function storeRefreshToken(userId, token, familyId, expiresAt) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const { error } = await supabase
    .from('refresh_tokens')
    .insert({
      token_hash: tokenHash,
      user_id: userId,
      family_id: familyId,
      expires_at: expiresAt.toISOString(),
      consumed: false,
      revoked: false,
      created_at: new Date().toISOString(),
    });
  if (error) {
    console.error('[tokenService] Failed to store refresh token:', error.message);
    throw new Error('Failed to store refresh token');
  }
}

/**
 * Rotate a refresh token:
 * 1. Hash the incoming token, look it up
 * 2. If not found → reject
 * 3. If revoked → reject (already logged out)
 * 4. If consumed → REUSE ATTACK: revoke entire family, log, reject
 * 5. If expired → reject
 * 6. Mark as consumed
 * 7. Issue new refresh token in the same family
 *
 * Returns: { newToken, familyId, expiresAt, userId } or throws
 */
async function rotateRefreshToken(incomingToken, ip = 'unknown') {
  const tokenHash = crypto.createHash('sha256').update(incomingToken).digest('hex');

  // Look up the token
  const { data: record, error } = await supabase
    .from('refresh_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error) {
    console.error('[tokenService] DB error during refresh lookup:', error.message);
    throw new Error('Token lookup failed');
  }

  if (!record) {
    throw new TokenError('INVALID', 'Refresh token not found');
  }

  // Revoked check (logout, password change)
  if (record.revoked) {
    await logEvent(record.user_id, null, 'refresh_token_revoked_use', ip, {
      family_id: record.family_id,
    });
    throw new TokenError('REVOKED', 'Token has been revoked');
  }

  // REUSE DETECTION: Token already consumed → attack in progress
  if (record.consumed) {
    // Revoke the ENTIRE family — attacker and legitimate user both lose access
    await revokeFamilyTokens(record.family_id, record.user_id, ip, 'reuse_detected');
    throw new TokenError('REUSE', 'Token reuse detected — all sessions revoked');
  }

  // Expiry check
  if (new Date(record.expires_at) < new Date()) {
    await logEvent(record.user_id, null, 'refresh_token_expired', ip, {
      family_id: record.family_id,
    });
    throw new TokenError('EXPIRED', 'Refresh token expired');
  }

  // Mark current token as consumed (atomically)
  const { error: updateError } = await supabase
    .from('refresh_tokens')
    .update({ consumed: true, consumed_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)
    .eq('consumed', false); // Prevent race: only update if still unconsumed

  if (updateError) {
    console.error('[tokenService] Failed to consume token:', updateError.message);
    throw new Error('Failed to consume token');
  }

  // Issue new token in the same family
  const newRefresh = generateRefreshToken(record.family_id);
  await storeRefreshToken(record.user_id, newRefresh.token, newRefresh.familyId, newRefresh.expiresAt);

  await logEvent(record.user_id, null, 'refresh_token_rotated', ip, {
    family_id: record.family_id,
  });

  return {
    newToken: newRefresh.token,
    familyId: record.family_id,
    expiresAt: newRefresh.expiresAt,
    userId: record.user_id,
  };
}

// ── Revocation ──

/**
 * Revoke all refresh tokens in a family (reuse attack response).
 */
async function revokeFamilyTokens(familyId, userId, ip, reason) {
  const { error } = await supabase
    .from('refresh_tokens')
    .update({ revoked: true, revoked_at: new Date().toISOString(), revoke_reason: reason })
    .eq('family_id', familyId);

  if (error) {
    console.error('[tokenService] Failed to revoke family tokens:', error.message);
  }

  await logEvent(userId, null, 'token_family_revoked', ip, {
    family_id: familyId,
    reason,
  });
}

/**
 * Revoke ALL refresh tokens for a user (password change, security event).
 */
async function revokeAllUserTokens(userId, ip, reason) {
  const { error } = await supabase
    .from('refresh_tokens')
    .update({ revoked: true, revoked_at: new Date().toISOString(), revoke_reason: reason })
    .eq('user_id', userId)
    .eq('revoked', false);

  if (error) {
    console.error('[tokenService] Failed to revoke all user tokens:', error.message);
  }

  await logEvent(userId, null, 'all_tokens_revoked', ip, {
    reason,
  });
}

/**
 * Revoke a single refresh token (logout).
 */
async function revokeSingleToken(token, ip = 'unknown') {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const { data: record } = await supabase
    .from('refresh_tokens')
    .select('user_id, family_id')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (!record) return; // Already gone — idempotent

  const { error } = await supabase
    .from('refresh_tokens')
    .update({ revoked: true, revoked_at: new Date().toISOString(), revoke_reason: 'logout' })
    .eq('token_hash', tokenHash);

  if (error) {
    console.error('[tokenService] Failed to revoke token:', error.message);
  }

  await logEvent(record.user_id, null, 'refresh_token_revoked', ip, {
    family_id: record.family_id,
    reason: 'logout',
  });
}

// ── Token Error ──

class TokenError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TokenError';
    this.code = code; // INVALID, REVOKED, REUSE, EXPIRED
  }
}

// ── Exports ──

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  rotateRefreshToken,
  revokeSingleToken,
  revokeAllUserTokens,
  revokeFamilyTokens,
  TokenError,
  ACCESS_TOKEN_EXPIRY_SECONDS,
};
