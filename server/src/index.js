import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

import { getEnv, getNumberEnv } from './config.js';
import { SqliteStorage } from './sqliteStorage.js';
import rateLimit from 'express-rate-limit';
import {
  createUserWithPassword,
  issueSession,
  normalizeEmail,
  revokeRefreshToken,
  rotateRefreshToken,
  verifyAccessToken,
  verifyPasswordLogin,
} from './auth.js';
import { verifyAppleIdToken, verifyGoogleIdToken } from './oauth.js';

const PORT = getNumberEnv('PORT', 8787);
const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const JWT_SECRET = getEnv('AUTH_JWT_SECRET', { optional: process.env.NODE_ENV !== 'production' });
const REFRESH_PEPPER = getEnv('AUTH_REFRESH_PEPPER', { optional: process.env.NODE_ENV !== 'production' });
const BACKUP_MAX_VERSIONS = Math.max(1, getNumberEnv('BACKUP_MAX_VERSIONS', 3));
const ANALYTICS_MIN_GROUP_SIZE = Math.max(1, getNumberEnv('ANALYTICS_MIN_GROUP_SIZE', 100));
const ANALYTICS_RETENTION_DAYS = Math.max(1, getNumberEnv('ANALYTICS_RETENTION_DAYS', 30));

const ALLOWED_ANALYTICS_EVENT_TYPES = new Set([
  'workout_session_completed',
  'exercise_outcome',
]);

const ALLOWED_GOALS = new Set([
  'calisthenics',
  'getting_taller',
  'faster',
  'flexible',
  'mental_clarity',
  'building_muscle',
]);

const ALLOWED_EXPERIENCE = new Set([
  'beginner',
  'intermediate',
  'advanced',
]);

function requireSecrets() {
  if (!JWT_SECRET || !REFRESH_PEPPER) {
    throw new Error('Missing AUTH_JWT_SECRET and/or AUTH_REFRESH_PEPPER');
  }
  return { jwtSecret: JWT_SECRET, refreshPepper: REFRESH_PEPPER };
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function makeBackupId() {
  return `b_${Date.now()}_${randomUUID()}`;
}

function userBackupDir(userId) {
  return path.join(BACKUPS_DIR, userId);
}

function hashEmail(email) {
  return createHash('sha256').update(String(email || '').toLowerCase()).digest('hex');
}

function toPositiveInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function sanitizeLimitedText(value, fallback = 'unknown', maxLength = 64) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return fallback;
  return raw.slice(0, maxLength);
}

function normalizeDateKey(ts) {
  const date = new Date(Number(ts));
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function toBinarySuccess(value) {
  return value ? 1 : 0;
}

function enforceAnalyticsRetention(buckets) {
  const minTs = Date.now() - ANALYTICS_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return buckets.filter((bucket) => {
    const ts = Number(bucket.last_event_at || bucket.first_event_at || 0);
    return Number.isFinite(ts) && ts >= minTs;
  });
}

function sanitizeAnalyticsEvent(rawEvent) {
  const eventType = sanitizeLimitedText(rawEvent?.event_type, '', 48);
  if (!ALLOWED_ANALYTICS_EVENT_TYPES.has(eventType)) return null;

  const occurredAtRaw = Number(rawEvent?.occurred_at);
  const occurredAt = Number.isFinite(occurredAtRaw) && occurredAtRaw > 0 ? Math.floor(occurredAtRaw) : Date.now();

  const goal = sanitizeLimitedText(rawEvent?.goal, 'unknown', 32);
  const experience = sanitizeLimitedText(rawEvent?.experience, 'unknown', 32);
  const exerciseId = sanitizeLimitedText(rawEvent?.exercise_id, 'all', 64);
  const success = toBinarySuccess(rawEvent?.success);
  const setsCompleted = Math.max(0, toPositiveInt(rawEvent?.sets_completed, 0));
  const durationSeconds = Math.max(0, toPositiveInt(rawEvent?.duration_seconds, 0));

  return {
    event_type: eventType,
    occurred_at: occurredAt,
    date_key: normalizeDateKey(occurredAt),
    goal: ALLOWED_GOALS.has(goal) ? goal : 'unknown',
    experience: ALLOWED_EXPERIENCE.has(experience) ? experience : 'unknown',
    exercise_id: exerciseId,
    success,
    sets_completed: setsCompleted,
    duration_seconds: durationSeconds,
  };
}

function analyticsKey(event) {
  return [event.date_key, event.event_type, event.goal, event.experience, event.exercise_id].join('|');
}

function mergeIntoBuckets(existingBuckets, events) {
  const index = new Map(existingBuckets.map((bucket) => [analyticsKey(bucket), { ...bucket }]));

  for (const event of events) {
    const key = analyticsKey(event);
    const current = index.get(key);
    if (!current) {
      index.set(key, {
        date_key: event.date_key,
        event_type: event.event_type,
        goal: event.goal,
        experience: event.experience,
        exercise_id: event.exercise_id,
        total_events: 1,
        success_count: event.success,
        failure_count: event.success ? 0 : 1,
        sets_total: event.sets_completed,
        duration_seconds_total: event.duration_seconds,
        first_event_at: event.occurred_at,
        last_event_at: event.occurred_at,
      });
      continue;
    }

    current.total_events += 1;
    current.success_count += event.success;
    current.failure_count += event.success ? 0 : 1;
    current.sets_total += event.sets_completed;
    current.duration_seconds_total += event.duration_seconds;
    current.first_event_at = Math.min(current.first_event_at, event.occurred_at);
    current.last_event_at = Math.max(current.last_event_at, event.occurred_at);
  }

  return Array.from(index.values());
}

async function requireAnalyticsConsent(req, res, next) {
  try {
    const users = await storage.getUsers();
    const user = users.find((entry) => entry.id === req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.consentTimestamp) {
      return res.status(403).json({
        error: 'Privacy consent required before analytics ingestion',
      });
    }
    return next();
  } catch {
    return res.status(500).json({ error: 'Consent check failed' });
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, obj) {
  const raw = JSON.stringify(obj);
  await fs.writeFile(filePath, raw, 'utf8');
}

async function pruneOldBackups(userId) {
  const dir = userBackupDir(userId);
  await ensureDir(dir);
  const names = await fs.readdir(dir);
  const records = [];

  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const filePath = path.join(dir, name);
    const record = await readJson(filePath).catch(() => null);
    if (!record || typeof record.createdAt !== 'number') continue;
    records.push({ filePath, createdAt: record.createdAt });
  }

  records.sort((a, b) => b.createdAt - a.createdAt);
  const toDelete = records.slice(BACKUP_MAX_VERSIONS);
  await Promise.all(toDelete.map((entry) => fs.unlink(entry.filePath).catch(() => undefined)));
}

function getBearerToken(req) {
  const raw = req.header('authorization') || '';
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: 'Missing Authorization bearer token' });
    const { jwtSecret } = requireSecrets();
    const payload = verifyAccessToken(token, jwtSecret);
    req.userId = String(payload.sub);
    req.user = {
      id: String(payload.sub),
      email: typeof payload.email === 'string' ? payload.email : '',
      name: typeof payload.name === 'string' ? payload.name : '',
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

const storage = new SqliteStorage({ dataDir: DATA_DIR });
await storage.init();

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '25mb' }));

// ── Rate limiters ──────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,                   // 15 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later' },
});

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 120,                   // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
});

app.use(globalLimiter);
// ────────────────────────────────────────────────────────────────────

app.get('/health', async (_req, res) => {
  res.json({ ok: true });
});

app.post('/auth/email/register', authLimiter, async (req, res) => {
  try {
    const { jwtSecret, refreshPepper } = requireSecrets();
    const email = normalizeEmail(req.body?.email);
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    const user = await createUserWithPassword({ storage, email, name, password });
    const session = await issueSession({ storage, user, jwtSecret, refreshPepper });
    res.status(201).json(session);
  } catch (e) {
    const message = e?.message || 'Registration failed';
    res.status(400).json({ error: message });
  }
});

app.post('/auth/email/login', authLimiter, async (req, res) => {
  try {
    const { jwtSecret, refreshPepper } = requireSecrets();
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const user = await verifyPasswordLogin({ storage, email, password });
    const session = await issueSession({ storage, user, jwtSecret, refreshPepper });
    res.json(session);
  } catch (e) {
    res.status(401).json({ error: 'Invalid email or password' });
  }
});

app.post('/auth/refresh', authLimiter, async (req, res) => {
  try {
    const { jwtSecret, refreshPepper } = requireSecrets();
    const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';
    const session = await rotateRefreshToken({ storage, refreshToken, jwtSecret, refreshPepper });
    res.json(session);
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

app.post('/auth/logout', async (req, res) => {
  try {
    const { refreshPepper } = requireSecrets();
    const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';
    await revokeRefreshToken({ storage, refreshToken, refreshPepper });
    res.status(204).end();
  } catch {
    res.status(204).end();
  }
});

app.post('/users/consent', requireAuth, async (req, res) => {
  try {
    const users = await storage.getUsers();
    const user = users.find((u) => u.id === req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.consentTimestamp = Date.now();
    user.updatedAt = Date.now();
    await storage.saveUsers(users);

    return res.status(200).json({ ok: true, consentTimestamp: user.consentTimestamp });
  } catch {
    return res.status(500).json({ error: 'Failed to record consent' });
  }
});

app.post('/users/migrate', requireAuth, async (req, res) => {
  try {
    const deviceId = typeof req.body?.deviceId === 'string' ? req.body.deviceId.trim() : '';
    if (!deviceId) return res.status(400).json({ error: 'deviceId is required' });

    const migrations = await storage.getMigrations();
    const now = Date.now();
    const existing = migrations.find((m) => m.userId === req.userId && m.deviceId === deviceId);

    if (existing) {
      existing.last_synced_at = now;
    } else {
      migrations.push({
        id: `mig_${randomUUID()}`,
        userId: req.userId,
        deviceId,
        last_synced_at: now,
      });
    }

    await storage.saveMigrations(migrations);
    return res.status(200).json({ ok: true, deviceId, last_synced_at: now });
  } catch {
    return res.status(500).json({ error: 'Failed to register migration device' });
  }
});

app.get('/users/export', requireAuth, async (req, res) => {
  try {
    const users = await storage.getUsers();
    const user = users.find((u) => u.id === req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await ensureDir(userBackupDir(req.userId));
    const names = await fs.readdir(userBackupDir(req.userId));
    const backups = [];
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      const filePath = path.join(userBackupDir(req.userId), name);
      const record = await readJson(filePath);
      backups.push({
        id: record.id,
        createdAt: record.createdAt,
        meta: record.meta,
        blob: record.blob,
      });
    }

    const migrations = (await storage.getMigrations()).filter((m) => m.userId === req.userId);
    const syncStateMeta = (await storage.getSyncStateMetas()).find((m) => m.userId === req.userId) || null;
    const syncEvents = (await storage.getSyncEvents())
      .filter((e) => e.userId === req.userId)
      .sort((a, b) => a.occurredAt - b.occurredAt);

    return res.status(200).json({
      exportedAt: Date.now(),
      user: {
        id: user.id,
        email_hash: hashEmail(user.email || ''),
        created_at: user.createdAt,
        last_login: user.updatedAt,
        consent_timestamp: user.consentTimestamp || null,
      },
      backups,
      migrations,
      sync_state_meta: syncStateMeta,
      sync_events: syncEvents,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to export user data' });
  }
});

app.delete('/users/data', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    const users = await storage.getUsers();
    await storage.saveUsers(users.filter((u) => u.id !== userId));

    const sessions = await storage.getRefreshSessions();
    await storage.saveRefreshSessions(sessions.filter((s) => s.userId !== userId));

    const migrations = await storage.getMigrations();
    await storage.saveMigrations(migrations.filter((m) => m.userId !== userId));

    const syncStateMetas = await storage.getSyncStateMetas();
    await storage.saveSyncStateMetas(syncStateMetas.filter((m) => m.userId !== userId));

    const syncEvents = await storage.getSyncEvents();
    await storage.saveSyncEvents(syncEvents.filter((e) => e.userId !== userId));

    await fs.rm(userBackupDir(userId), { recursive: true, force: true });

    return res.status(204).end();
  } catch {
    return res.status(500).json({ error: 'Failed to delete user data' });
  }
});

app.post('/auth/google', async (req, res) => {
  try {
    const { jwtSecret, refreshPepper } = requireSecrets();
    const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : '';
    const audience = getEnv('GOOGLE_CLIENT_ID', { optional: true });
    if (!audience) return res.status(501).json({ error: 'Google auth not configured' });
    const info = await verifyGoogleIdToken(idToken, audience);
    if (!info.providerUserId) return res.status(401).json({ error: 'Invalid token' });
    const { upsertOAuthUser } = await import('./auth.js');
    const user = await upsertOAuthUser({
      storage,
      provider: 'google',
      providerUserId: info.providerUserId,
      email: info.email,
      name: info.name,
    });
    const session = await issueSession({ storage, user, jwtSecret, refreshPepper });
    res.json(session);
  } catch {
    res.status(401).json({ error: 'Google auth failed' });
  }
});

app.post('/auth/apple', async (req, res) => {
  try {
    const { jwtSecret, refreshPepper } = requireSecrets();
    const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : '';
    const audience = getEnv('APPLE_CLIENT_ID', { optional: true });
    if (!audience) return res.status(501).json({ error: 'Apple auth not configured' });
    const info = await verifyAppleIdToken(idToken, audience);
    if (!info.providerUserId) return res.status(401).json({ error: 'Invalid token' });
    const { upsertOAuthUser } = await import('./auth.js');
    const user = await upsertOAuthUser({
      storage,
      provider: 'apple',
      providerUserId: info.providerUserId,
      email: info.email,
      name: null,
    });
    const session = await issueSession({ storage, user, jwtSecret, refreshPepper });
    res.json(session);
  } catch {
    res.status(401).json({ error: 'Apple auth failed' });
  }
});

// Dev-only helper retained for local testing.
app.post('/auth/dev', async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).end();
  const { jwtSecret, refreshPepper } = requireSecrets();
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const normalized = email ? normalizeEmail(email) : 'user@fitquest.local';

  const users = await storage.getUsers();
  let user = users.find((u) => u.email === normalized);
  if (!user) {
    user = {
      id: `user_${randomUUID()}`,
      email: normalized,
      name: normalized.split('@')[0],
      passwordHash: null,
      providers: [{ provider: 'dev', providerUserId: normalized }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    users.push(user);
    await storage.saveUsers(users);
  }

  const session = await issueSession({ storage, user, jwtSecret, refreshPepper });
  res.json(session);
});

app.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

app.post('/backups', requireAuth, async (req, res) => {
  try {
    await ensureDir(BACKUPS_DIR);
    await ensureDir(userBackupDir(req.userId));

    const blob = req.body?.blob;
    const meta = req.body?.meta;

    if (typeof blob !== 'string' || blob.length === 0) {
      return res.status(400).json({ error: 'Missing blob' });
    }

    const id = makeBackupId();
    const createdAt = Date.now();
    const record = {
      id,
      userId: req.userId,
      createdAt,
      meta: meta && typeof meta === 'object' ? meta : null,
      blob,
    };

    const outPath = path.join(userBackupDir(req.userId), `${id}.json`);
    await writeJson(outPath, record);
    await pruneOldBackups(req.userId);

    res.status(201).json({ id, createdAt });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

app.get('/backups', requireAuth, async (req, res) => {
  try {
    await ensureDir(userBackupDir(req.userId));
    const names = await fs.readdir(userBackupDir(req.userId));
    const backups = [];

    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      const filePath = path.join(userBackupDir(req.userId), name);
      const record = await readJson(filePath);
      backups.push({ id: record.id, createdAt: record.createdAt, meta: record.meta });
    }

    backups.sort((a, b) => b.createdAt - a.createdAt);
    res.json({ backups });
  } catch (e) {
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

app.get('/backups/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const filePath = path.join(userBackupDir(req.userId), `${id}.json`);
    const record = await readJson(filePath);
    if (record.userId !== req.userId) return res.status(404).json({ error: 'Not found' });
    res.json({ id: record.id, createdAt: record.createdAt, meta: record.meta, blob: record.blob });
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

app.put('/backups/:id', requireAuth, async (req, res) => {
  try {
    await ensureDir(BACKUPS_DIR);
    await ensureDir(userBackupDir(req.userId));

    const id = req.params.id;
    const blob = req.body?.blob;
    const meta = req.body?.meta;
    if (typeof blob !== 'string' || blob.length === 0) {
      return res.status(400).json({ error: 'Missing blob' });
    }

    const filePath = path.join(userBackupDir(req.userId), `${id}.json`);
    const now = Date.now();
    const existing = await readJson(filePath).catch(() => null);

    const record = {
      id,
      userId: req.userId,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      meta: meta && typeof meta === 'object' ? meta : existing?.meta || null,
      blob,
    };

    await writeJson(filePath, record);
    return res.status(200).json({ id, createdAt: record.createdAt, updatedAt: now });
  } catch {
    return res.status(500).json({ error: 'Failed to overwrite backup' });
  }
});

app.delete('/backups/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const filePath = path.join(userBackupDir(req.userId), `${id}.json`);
    await fs.unlink(filePath);
    res.status(204).end();
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

app.get('/sync/state-meta/latest', requireAuth, async (req, res) => {
  try {
    const metas = await storage.getSyncStateMetas();
    const latest = metas.find((meta) => meta.userId === req.userId) || null;
    return res.status(200).json({ state_meta: latest });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch latest state metadata' });
  }
});

app.put('/sync/state-meta', requireAuth, async (req, res) => {
  try {
    const version = toPositiveInt(req.body?.version, 0);
    const baseHash = typeof req.body?.base_hash === 'string' ? req.body.base_hash.trim() : '';
    const stateHash = typeof req.body?.state_hash === 'string' ? req.body.state_hash.trim() : '';
    const backupId = typeof req.body?.backup_id === 'string' ? req.body.backup_id.trim() : null;
    const deviceId = typeof req.body?.device_id === 'string' ? req.body.device_id.trim() : null;

    if (!version) return res.status(400).json({ error: 'version must be a positive integer' });
    if (!baseHash) return res.status(400).json({ error: 'base_hash is required' });
    if (!stateHash) return res.status(400).json({ error: 'state_hash is required' });

    const metas = await storage.getSyncStateMetas();
    const now = Date.now();
    const existing = metas.find((meta) => meta.userId === req.userId) || null;

    if (existing && version < existing.version) {
      return res.status(409).json({
        error: 'Stale state version',
        latest: existing,
      });
    }

    if (existing && version === existing.version && existing.state_hash !== stateHash) {
      return res.status(409).json({
        error: 'State hash conflict at same version',
        latest: existing,
      });
    }

    const next = {
      userId: req.userId,
      version,
      base_hash: baseHash,
      state_hash: stateHash,
      backup_id: backupId || null,
      device_id: deviceId || existing?.device_id || null,
      updated_at: now,
    };

    const remaining = metas.filter((meta) => meta.userId !== req.userId);
    remaining.push(next);
    await storage.saveSyncStateMetas(remaining);

    return res.status(200).json({ ok: true, state_meta: next });
  } catch {
    return res.status(500).json({ error: 'Failed to save state metadata' });
  }
});

app.get('/sync/events', requireAuth, async (req, res) => {
  try {
    const since = Number.isFinite(Number(req.query.since)) ? Number(req.query.since) : 0;
    const limit = Math.min(1000, Math.max(1, toPositiveInt(req.query.limit, 200)));

    const events = (await storage.getSyncEvents())
      .filter((event) => event.userId === req.userId && event.occurredAt >= since)
      .sort((a, b) => a.occurredAt - b.occurredAt)
      .slice(0, limit);

    return res.status(200).json({ events });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch sync events' });
  }
});

app.post('/sync/events', requireAuth, async (req, res) => {
  try {
    const inputEvents = Array.isArray(req.body?.events)
      ? req.body.events
      : req.body?.event
        ? [req.body.event]
        : [];

    if (!inputEvents.length) {
      return res.status(400).json({ error: 'events array is required' });
    }

    const events = await storage.getSyncEvents();
    const existingIds = new Set(
      events
        .filter((event) => event.userId === req.userId)
        .map((event) => event.id)
    );

    const accepted = [];
    let skipped = 0;
    const now = Date.now();

    for (const rawEvent of inputEvents) {
      const id = typeof rawEvent?.id === 'string' ? rawEvent.id.trim() : '';
      const eventType = typeof rawEvent?.event_type === 'string' ? rawEvent.event_type.trim() : '';
      const occurredAtRaw = Number(rawEvent?.occurred_at);
      const occurredAt = Number.isFinite(occurredAtRaw) && occurredAtRaw > 0 ? Math.floor(occurredAtRaw) : now;
      const deviceId = typeof rawEvent?.device_id === 'string' ? rawEvent.device_id.trim() : null;
      const stateVersion = toPositiveInt(rawEvent?.state_version, 0) || null;
      const payload = rawEvent?.payload && typeof rawEvent.payload === 'object' ? rawEvent.payload : {};

      if (!id || !eventType) {
        skipped += 1;
        continue;
      }

      if (existingIds.has(id)) {
        skipped += 1;
        continue;
      }

      const normalized = {
        id,
        userId: req.userId,
        event_type: eventType,
        occurredAt,
        createdAt: now,
        device_id: deviceId,
        state_version: stateVersion,
        payload,
      };

      events.push(normalized);
      accepted.push(normalized);
      existingIds.add(id);
    }

    await storage.saveSyncEvents(events);
    return res.status(200).json({
      ok: true,
      accepted_count: accepted.length,
      skipped_count: skipped,
      accepted,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to append sync events' });
  }
});

app.post('/analytics/events', requireAuth, requireAnalyticsConsent, async (req, res) => {
  try {
    const inputEvents = Array.isArray(req.body?.events)
      ? req.body.events
      : req.body?.event
        ? [req.body.event]
        : [];

    if (!inputEvents.length) {
      return res.status(400).json({ error: 'events array is required' });
    }

    const sanitizedEvents = inputEvents
      .map((rawEvent) => sanitizeAnalyticsEvent(rawEvent))
      .filter(Boolean);

    if (!sanitizedEvents.length) {
      return res.status(400).json({ error: 'No valid analytics events after sanitization' });
    }

    const currentBuckets = await storage.getAnalyticsBuckets();
    const merged = mergeIntoBuckets(currentBuckets, sanitizedEvents);
    const retained = enforceAnalyticsRetention(merged);
    await storage.saveAnalyticsBuckets(retained);

    return res.status(202).json({
      ok: true,
      accepted_count: sanitizedEvents.length,
      dropped_count: inputEvents.length - sanitizedEvents.length,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to ingest analytics events' });
  }
});

app.get('/analytics/summary', requireAuth, requireAnalyticsConsent, async (req, res) => {
  try {
    const minCount = Math.max(1, toPositiveInt(req.query.min_count, ANALYTICS_MIN_GROUP_SIZE));
    const sinceDays = Math.max(1, toPositiveInt(req.query.since_days, 30));
    const sinceTs = Date.now() - sinceDays * 24 * 60 * 60 * 1000;

    const buckets = (await storage.getAnalyticsBuckets())
      .filter((bucket) => Number(bucket.last_event_at || 0) >= sinceTs)
      .filter((bucket) => (bucket.total_events || 0) >= minCount)
      .map((bucket) => {
        const total = Math.max(1, bucket.total_events || 0);
        return {
          ...bucket,
          completion_rate: Number(((bucket.success_count || 0) / total).toFixed(4)),
          average_sets: Number(((bucket.sets_total || 0) / total).toFixed(2)),
          average_duration_seconds: Number(((bucket.duration_seconds_total || 0) / total).toFixed(2)),
        };
      })
      .sort((a, b) => b.total_events - a.total_events);

    return res.status(200).json({
      min_count_applied: minCount,
      since_days_applied: sinceDays,
      groups: buckets,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to compute analytics summary' });
  }
});

app.get('/analytics/tuning-suggestions', requireAuth, requireAnalyticsConsent, async (req, res) => {
  try {
    const minCount = Math.max(1, toPositiveInt(req.query.min_count, ANALYTICS_MIN_GROUP_SIZE));
    const sinceDays = Math.max(1, toPositiveInt(req.query.since_days, 30));
    const sinceTs = Date.now() - sinceDays * 24 * 60 * 60 * 1000;

    const groups = (await storage.getAnalyticsBuckets())
      .filter((bucket) => Number(bucket.last_event_at || 0) >= sinceTs)
      .filter((bucket) => bucket.event_type === 'exercise_outcome')
      .filter((bucket) => (bucket.total_events || 0) >= minCount);

    const suggestions = groups
      .map((bucket) => {
        const total = Math.max(1, bucket.total_events || 0);
        const failureRate = (bucket.failure_count || 0) / total;
        const completionRate = (bucket.success_count || 0) / total;
        const averageSets = (bucket.sets_total || 0) / total;

        let recommendation = 'keep_default';
        if (failureRate >= 0.45) recommendation = 'reduce_default_volume';
        else if (completionRate >= 0.92 && averageSets >= 3) recommendation = 'increase_default_volume';

        return {
          date_key: bucket.date_key,
          goal: bucket.goal,
          experience: bucket.experience,
          exercise_id: bucket.exercise_id,
          total_events: total,
          failure_rate: Number(failureRate.toFixed(4)),
          completion_rate: Number(completionRate.toFixed(4)),
          average_sets: Number(averageSets.toFixed(2)),
          recommendation,
        };
      })
      .filter((suggestion) => suggestion.recommendation !== 'keep_default')
      .sort((a, b) => b.total_events - a.total_events);

    return res.status(200).json({
      min_count_applied: minCount,
      since_days_applied: sinceDays,
      suggestions,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to compute tuning suggestions' });
  }
});

await ensureDir(DATA_DIR);
await ensureDir(BACKUPS_DIR);

const server = app.listen(PORT, () => {
  console.log(`[fitquest-backend] listening on http://localhost:${PORT}`);
});

// Graceful shutdown — close SQLite WAL cleanly
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`[fitquest-backend] ${sig} received, shutting down…`);
    server.close(() => {
      storage.close();
      process.exit(0);
    });
  });
}
