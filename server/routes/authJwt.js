/**
 * Auth Routes — JWT-based email authentication.
 *
 * POST /auth/email/register — Create account, return JWT session
 * POST /auth/email/login    — Authenticate, return JWT session
 * POST /auth/refresh        — Rotate refresh token, issue new access token
 * POST /auth/logout         — Revoke refresh token
 * POST /auth/logout-all     — Revoke ALL refresh tokens for user (password change)
 *
 * Access tokens: 15-minute HS256 JWTs
 * Refresh tokens: 30-day opaque tokens with rotation + family tracking
 *
 * SECURITY:
 * - Passwords hashed with bcrypt (12 rounds)
 * - Refresh tokens stored as SHA-256 hashes (never plaintext)
 * - Token reuse → entire family revoked
 * - No silent fallbacks — every failure is explicit
 */
'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const router = express.Router();
const supabase = require('../utils/supabaseClient');
const respond = require('../utils/respond');
const logEvent = require('../utils/logEvent');
const {
  signAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  rotateRefreshToken,
  revokeSingleToken,
  revokeAllUserTokens,
  TokenError,
} = require('../utils/tokenService');

const BCRYPT_ROUNDS = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── POST /auth/email/register ──

router.post('/auth/email/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';

    // Validate inputs
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
      return respond(res, 400, null, 'Valid email is required.');
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return respond(res, 400, null, 'Password must be at least 8 characters.');
    }
    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      return respond(res, 400, null, 'Name is required.');
    }

    const sanitizedEmail = email.trim().toLowerCase().slice(0, 256);
    const sanitizedName = name.trim().slice(0, 128);

    // Check if user already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', sanitizedEmail)
      .maybeSingle();

    if (existing) {
      return respond(res, 409, null, 'A user with this email already exists.');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user
    const userId = crypto.randomUUID();
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: sanitizedEmail,
        name: sanitizedName,
        password_hash: passwordHash,
      });

    if (insertError) {
      if (insertError.code === '23505') {
        return respond(res, 409, null, 'A user with this email already exists.');
      }
      console.error('[auth/register] Insert error:', insertError.message);
      return respond(res, 500, null, 'Failed to create account.');
    }

    // Issue tokens
    const accessToken = signAccessToken(userId, sanitizedEmail);
    const refresh = generateRefreshToken();
    await storeRefreshToken(userId, refresh.token, refresh.familyId, refresh.expiresAt);

    await logEvent(userId, null, 'user_registered', ip, { method: 'email' });

    return respond(res, 201, {
      accessToken,
      refreshToken: refresh.token,
      user: { id: userId, email: sanitizedEmail, name: sanitizedName },
    });
  } catch (err) {
    console.error('[auth/register] Error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /auth/email/login ──

router.post('/auth/email/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';

    if (!email || typeof email !== 'string') {
      return respond(res, 400, null, 'Email is required.');
    }
    if (!password || typeof password !== 'string') {
      return respond(res, 400, null, 'Password is required.');
    }

    const sanitizedEmail = email.trim().toLowerCase().slice(0, 256);

    // Look up user
    const { data: user, error: lookupError } = await supabase
      .from('users')
      .select('id, email, name, password_hash')
      .eq('email', sanitizedEmail)
      .maybeSingle();

    if (lookupError) {
      console.error('[auth/login] Lookup error:', lookupError.message);
      return respond(res, 500, null, 'Internal server error.');
    }

    // Constant-time-ish rejection: always hash even if user not found
    if (!user) {
      // Burn time to prevent timing attacks on user enumeration
      await bcrypt.hash(password, BCRYPT_ROUNDS);
      return respond(res, 401, null, 'Invalid email or password.');
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await logEvent(user.id, null, 'login_failed', ip, { reason: 'wrong_password' });
      return respond(res, 401, null, 'Invalid email or password.');
    }

    // Issue tokens
    const accessToken = signAccessToken(user.id, user.email);
    const refresh = generateRefreshToken();
    await storeRefreshToken(user.id, refresh.token, refresh.familyId, refresh.expiresAt);

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    await logEvent(user.id, null, 'login_success', ip, { method: 'email' });

    return respond(res, 200, {
      accessToken,
      refreshToken: refresh.token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    console.error('[auth/login] Error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /auth/refresh ──

router.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';

    if (!refreshToken || typeof refreshToken !== 'string') {
      return respond(res, 400, null, 'Refresh token is required.');
    }

    // Rotate: consumes old token, issues new one in same family
    const result = await rotateRefreshToken(refreshToken, ip);

    // Look up user for the access token
    const { data: user } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', result.userId)
      .maybeSingle();

    if (!user) {
      return respond(res, 401, null, 'User not found.');
    }

    const accessToken = signAccessToken(user.id, user.email);

    return respond(res, 200, {
      accessToken,
      refreshToken: result.newToken,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    if (err instanceof TokenError) {
      const status = err.code === 'REUSE' ? 403 : 401;
      return respond(res, status, null, err.message);
    }
    console.error('[auth/refresh] Error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

// ── POST /auth/logout ──

router.post('/auth/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';

    if (refreshToken && typeof refreshToken === 'string') {
      await revokeSingleToken(refreshToken, ip);
    }

    return respond(res, 200, { ok: true });
  } catch (err) {
    console.error('[auth/logout] Error:', err.message);
    // Logout should always succeed from client perspective
    return respond(res, 200, { ok: true });
  }
});

// ── POST /auth/logout-all ──
// Protected route — requires valid access token (checked by requireAuth)

router.post('/auth/logout-all', async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const userId = req.user?.sub; // Set by requireAuth middleware

    if (!userId) {
      return respond(res, 401, null, 'Authentication required.');
    }

    await revokeAllUserTokens(userId, ip, 'logout_all');

    return respond(res, 200, { ok: true, message: 'All sessions logged out.' });
  } catch (err) {
    console.error('[auth/logout-all] Error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

module.exports = router;
