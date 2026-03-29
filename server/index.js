/**
 * FitQuest Backend Authority Server — Phase 23
 *
 * Full audit remediation: HMAC signatures, CORS lockdown, semver,
 * graceful shutdown, DB optimization, data retention.
 * All internal scores (trust_score, anomaly_score, effectiveTrust) server-only.
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

// CORS — S3 fix: restrict origins (no wildcard)
const allowedOrigins = [
  'https://fitquest-gbhv.onrender.com',
  process.env.CORS_ALLOWED_ORIGIN,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS: origin not allowed'));
  },
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
    version: '2.6.0',
    phase: 23,
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

let server;
if (require.main === module) {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FitQuest Authority] v2.6.0 (Phase 23) listening on port ${PORT}`);
    console.log(`[FitQuest Authority] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

// ── A5 fix: Graceful shutdown ──

function gracefulShutdown(signal) {
  console.log(`[FitQuest Authority] ${signal} received — shutting down gracefully.`);
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
