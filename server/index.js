/**
 * FitQuest Backend Authority Server — Phase 22.3
 *
 * Anti-abuse hardening: trust, anomaly detection, AI usage monitoring.
 * All internal scores (trust_score, anomaly_score, effectiveTrust) server-only.
 * Enriched anomaly metadata, high-severity audit logging, RLS enforcement.
 * Client is untrusted. Server decides everything.
 *
 * Stack: Express + Supabase (service_role)
 * Deploy: Render (https://fitquest-gbhv.onrender.com)
 */

'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const respond = require('./utils/respond');

// ── Express setup ──

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

// CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-App-Version', 'X-Device-ID'],
}));

// JSON body parsing
app.use(express.json({ limit: '100kb' }));

// ── Global Middleware ──

/**
 * Reject POST requests without a JSON body.
 */
app.use((req, res, next) => {
  if (req.method === 'POST' && (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0)) {
    return respond(res, 400, null, 'Request body is required and must be valid JSON.');
  }
  next();
});

/**
 * In-memory rate limiter (per IP). 60 req/min.
 */
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 60;

app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return next();
  }

  const entry = rateLimitMap.get(ip);
  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry.count = 1;
    entry.windowStart = now;
    return next();
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) {
    return respond(res, 429, null, 'Rate limit exceeded. Try again later.');
  }

  next();
});

// Periodic cleanup (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

/**
 * Request logger (structured JSON).
 */
app.use((req, _res, next) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip,
    user_id: req.body?.user_id || req.body?.id || '-',
    app_version: req.headers['x-app-version'] || '-',
    device_id: req.headers['x-device-id'] || '-',
  }));
  next();
});

// ── Health Check ──

app.get('/health', (_req, res) => {
  respond(res, 200, {
    service: 'fitquest-authority',
    version: '2.5.0',
    phase: 22.3,
    status: 'operational',
    timestamp: new Date().toISOString(),
  });
});

// ── Routes ──

app.use(require('./routes/user'));
app.use(require('./routes/subscription'));
app.use(require('./routes/device'));
app.use(require('./routes/ai'));

// ── 404 catch-all ──

app.use((_req, res) => {
  respond(res, 404, null, 'Endpoint not found.');
});

// ── Global error handler ──

app.use((err, _req, res, _next) => {
  console.error('[UNHANDLED]', err.message);
  respond(res, 500, null, 'Internal server error.');
});

// ── Start server ──

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FitQuest Authority] v2.5.0 (Phase 22.3) listening on port ${PORT}`);
    console.log(`[FitQuest Authority] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
