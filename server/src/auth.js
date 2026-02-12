import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function hashRefreshToken(refreshToken, secret) {
  return createHash('sha256')
    .update(String(refreshToken))
    .update('|')
    .update(String(secret))
    .digest('hex');
}

export function generateRefreshToken() {
  return randomBytes(32).toString('base64url');
}

export function signAccessToken(user, jwtSecret) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
    },
    jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: '15m',
      issuer: 'fitquest',
      audience: 'fitquest-mobile',
    }
  );
}

export function verifyAccessToken(token, jwtSecret) {
  return jwt.verify(token, jwtSecret, {
    algorithms: ['HS256'],
    issuer: 'fitquest',
    audience: 'fitquest-mobile',
  });
}

export async function createUserWithPassword({ storage, email, name, password }) {
  const users = await storage.getUsers();
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('Invalid email');
  }
  if (users.some((u) => u.email === normalizedEmail)) {
    const err = new Error('Email already in use');
    err.code = 'EMAIL_TAKEN';
    throw err;
  }
  if (typeof password !== 'string' || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  const now = Date.now();
  const passwordHash = await bcrypt.hash(password, 12);
  const user = {
    id: `user_${randomUUID()}`,
    email: normalizedEmail,
    name: String(name || '').trim() || normalizedEmail.split('@')[0],
    passwordHash,
    providers: [],
    createdAt: now,
    updatedAt: now,
  };
  users.push(user);
  await storage.saveUsers(users);
  return user;
}

export async function verifyPasswordLogin({ storage, email, password }) {
  const users = await storage.getUsers();
  const normalizedEmail = normalizeEmail(email);
  const user = users.find((u) => u.email === normalizedEmail);
  if (!user || !user.passwordHash) {
    const err = new Error('Invalid email or password');
    err.code = 'INVALID_LOGIN';
    throw err;
  }

  const ok = await bcrypt.compare(String(password || ''), user.passwordHash);
  if (!ok) {
    const err = new Error('Invalid email or password');
    err.code = 'INVALID_LOGIN';
    throw err;
  }

  return user;
}

export async function upsertOAuthUser({ storage, provider, providerUserId, email, name }) {
  const users = await storage.getUsers();
  const now = Date.now();

  let user = users.find((u) => Array.isArray(u.providers) && u.providers.some((p) => p.provider === provider && p.providerUserId === providerUserId));
  if (!user && email) {
    const normalizedEmail = normalizeEmail(email);
    user = users.find((u) => u.email === normalizedEmail);
  }

  if (!user) {
    user = {
      id: `user_${randomUUID()}`,
      email: email ? normalizeEmail(email) : '',
      name: String(name || '').trim() || (email ? normalizeEmail(email).split('@')[0] : provider),
      passwordHash: null,
      providers: [{ provider, providerUserId }],
      createdAt: now,
      updatedAt: now,
    };
    users.push(user);
    await storage.saveUsers(users);
    return user;
  }

  const providers = Array.isArray(user.providers) ? user.providers : [];
  if (!providers.some((p) => p.provider === provider && p.providerUserId === providerUserId)) {
    providers.push({ provider, providerUserId });
  }

  user.providers = providers;
  if (email) user.email = user.email || normalizeEmail(email);
  if (name) user.name = user.name || String(name).trim();
  user.updatedAt = now;

  await storage.saveUsers(users);
  return user;
}

export async function issueSession({ storage, user, jwtSecret, refreshPepper }) {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken, refreshPepper);
  const accessToken = signAccessToken(user, jwtSecret);

  const sessions = await storage.getRefreshSessions();
  const now = Date.now();
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days

  sessions.push({
    id: `rs_${randomUUID()}`,
    userId: user.id,
    refreshTokenHash,
    createdAt: now,
    expiresAt,
    revokedAt: null,
    rotatedTo: null,
  });
  await storage.saveRefreshSessions(sessions);

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

export async function rotateRefreshToken({ storage, refreshToken, jwtSecret, refreshPepper }) {
  const sessions = await storage.getRefreshSessions();
  const refreshTokenHash = hashRefreshToken(refreshToken, refreshPepper);
  const existing = sessions.find((s) => s.refreshTokenHash === refreshTokenHash);

  if (!existing || existing.revokedAt || existing.expiresAt <= Date.now()) {
    const err = new Error('Invalid refresh token');
    err.code = 'INVALID_REFRESH';
    throw err;
  }

  const users = await storage.getUsers();
  const user = users.find((u) => u.id === existing.userId);
  if (!user) {
    const err = new Error('Invalid refresh token');
    err.code = 'INVALID_REFRESH';
    throw err;
  }

  const now = Date.now();
  const newRefreshToken = generateRefreshToken();
  const newRefreshTokenHash = hashRefreshToken(newRefreshToken, refreshPepper);
  const accessToken = signAccessToken(user, jwtSecret);

  existing.revokedAt = now;
  existing.rotatedTo = newRefreshTokenHash;

  const expiresAt = now + 30 * 24 * 60 * 60 * 1000;
  sessions.push({
    id: `rs_${randomUUID()}`,
    userId: user.id,
    refreshTokenHash: newRefreshTokenHash,
    createdAt: now,
    expiresAt,
    revokedAt: null,
    rotatedTo: null,
  });

  await storage.saveRefreshSessions(sessions);

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

export async function revokeRefreshToken({ storage, refreshToken, refreshPepper }) {
  const sessions = await storage.getRefreshSessions();
  const refreshTokenHash = hashRefreshToken(refreshToken, refreshPepper);
  const existing = sessions.find((s) => s.refreshTokenHash === refreshTokenHash);
  if (!existing) return;
  if (existing.revokedAt) return;
  existing.revokedAt = Date.now();
  await storage.saveRefreshSessions(sessions);
}
