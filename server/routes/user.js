/**
 * POST /user/create — Register user identity.
 * No trust middleware (user doesn't exist yet).
 */
'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabaseClient');
const respond = require('../utils/respond');
const logEvent = require('../utils/logEvent');

router.post('/user/create', async (req, res) => {
  try {
    const { id, email } = req.body;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    // Validate required fields
    if (!id || typeof id !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "id" field.');
    }
    if (!email || typeof email !== 'string') {
      return respond(res, 400, null, 'Missing or invalid "email" field.');
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return respond(res, 400, null, 'Invalid email format.');
    }

    // Sanitize inputs
    const sanitizedId = id.trim().slice(0, 128);
    const sanitizedEmail = email.trim().toLowerCase().slice(0, 256);

    // Check if user already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('id', sanitizedId)
      .maybeSingle();

    if (existing) {
      logEvent(sanitizedId, null, 'user_create_existing', ip);
      return respond(res, 200, { id: existing.id, created: false }, null);
    }

    // Insert new user (email is UNIQUE — Supabase will reject duplicates)
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        id: sanitizedId,
        email: sanitizedEmail,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        logEvent(sanitizedId, null, 'user_create_duplicate_email', ip);
        return respond(res, 409, null, 'A user with this email already exists.');
      }
      console.error('[/user/create] Supabase error:', error.message);
      return respond(res, 500, null, 'Failed to create user.');
    }

    logEvent(sanitizedId, null, 'user_created', ip);
    return respond(res, 201, { id: newUser.id, created: true });
  } catch (err) {
    console.error('[/user/create] Unexpected error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
});

module.exports = router;
