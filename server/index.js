/**
 * FitQuest Backend Authority Server — Phase 30
 *
 * Adaptive Response Engine — context-aware countermeasures.
 * Trust decay + alerting + enforcement + reputation + recovery + adaptive responses.
 * Device binding & persistent trust (server-issued device_token).
 * Challenge-response authentication (no client-side secrets).
 * Legacy HMAC signature support behind USE_LEGACY_SIGNATURE flag.
 * Full audit remediation, CORS lockdown, security headers,
 * replay protection, graceful shutdown, DB optimization, data retention.
 * All internal scores (trust_score, anomaly_score, effectiveTrust) server-only.
 *
 * Stack: Express + Supabase (service_role) + Helmet
 * Deploy: Render (https://fitq-56sj.onrender.com)
 */

'use strict';

require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const helmet = require('helmet');
const respond = require('./utils/respond');

// ── Express setup ──

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

// ── Security Headers (must come before routes) ──
app.use(helmet({
  contentSecurityPolicy: false, // API server — no HTML content
  crossOriginEmbedderPolicy: false, // Not serving embedded content
}));

// Disable X-Powered-By (also done by helmet, belt-and-suspenders)
app.disable('x-powered-by');

// CORS — S3 fix: strict origin enforcement
const allowedOrigins = [
  'https://fitquest-gbhv.onrender.com',
  process.env.CORS_ALLOWED_ORIGIN,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Mobile apps send no Origin header — allow only if no origin present
    // This is required for React Native fetch + curl/server-to-server
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS: origin not allowed'));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-App-Version', 'X-Device-ID', 'X-Device-Token'],
  credentials: false, // No cookies — API key auth only
  maxAge: 86400, // Cache preflight for 24h
}));

// JSON body parsing
app.use(express.json({ limit: '100kb' }));

// ── Global Middleware ──

/**
 * Auth enforcement middleware — validates authentication on all protected routes.
 * Uses requireAuth middleware (server/middleware/requireAuth.js).
 * Public routes (health, auth registration/login) are exempt.
 * ENFORCEMENT: No unguarded paths.
 */
const { requireAuth } = require('./middleware/requireAuth');

app.use(requireAuth());

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
    version: '5.0.0',
    phase: 30,
    status: 'operational',
    engines: ['trust_decay', 'anomaly', 'enforcement', 'reputation', 'adaptive_response'],
    timestamp: new Date().toISOString(),
  });
});

// ── Routes ──

app.use(require('./routes/webhooks'));  // Public — RevenueCat webhook (no JWT)
app.use(require('./routes/user'));
app.use(require('./routes/subscription'));
app.use(require('./routes/device'));
app.use(require('./routes/deviceBinding'));
app.use(require('./routes/authJwt'));  // JWT auth (register, login, refresh, logout)
app.use(require('./routes/auth'));     // Challenge-response auth (legacy)
app.use(require('./routes/ai'));
app.use(require('./routes/sync'));
app.use(require('./routes/admin'));  // Phase 30: Adaptive Response + Reputation + Enforcement

// ── 404 catch-all ──

app.use((_req, res) => {
  respond(res, 404, null, 'Endpoint not found.');
});

// ── Global error handler ──

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') {
    return respond(res, 413, null, 'Payload too large.');
  }
  if (err.status === 400 && err.type === 'entity.parse.failed') {
    return respond(res, 400, null, 'Malformed JSON.');
  }
  console.error('[UNHANDLED]', err.message);
  respond(res, err.status && err.status >= 400 && err.status < 600 ? err.status : 500, null, 'Internal server error.');
});

// ── Start server ──

const { startRetentionScheduler, stopRetentionScheduler } = require('./utils/retention');

let server;
if (require.main === module) {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FitQuest Authority] v5.0.0 (Phase 30 — Adaptive Response Engine) listening on port ${PORT}`);
    console.log(`[FitQuest Authority] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[FitQuest Authority] Legacy HMAC: ${process.env.USE_LEGACY_SIGNATURE === 'true' ? 'ENABLED' : 'DISABLED'}`);
    // D1-D3: Start data retention scheduler (60s delay, then every 24h)
    startRetentionScheduler();
  });
}

// ── A5 fix: Graceful shutdown ──

function gracefulShutdown(signal) {
  console.log(`[FitQuest Authority] ${signal} received — shutting down gracefully.`);
  stopRetentionScheduler(); // D1-D3: Stop retention scheduler
  if (server) {
    server.close(() => {
      console.log('[FitQuest Authority] HTTP server closed.');
      process.exit(0);
    });
    // Force exit after 10s if connections don't drain
    setTimeout(() => {
      console.error('[FitQuest Authority] Forced exit after timeout.');
      process.exit(1);
    }, 10_000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
