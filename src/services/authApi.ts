import {
  clearAuthCredentials,
  getAuthToken,
  getRefreshToken,
  getUserProfile,
  setAuthCredentials,
} from '../security/StorageMigration';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { requireApiBaseUrl } from './apiBaseUrl';
import { authEventBus } from './security/authEventBus';

export interface ServerUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthSessionResponse {
  accessToken: string;
  refreshToken: string;
  user: ServerUser;
}

export interface UserDataExport {
  exportedAt: number;
  user: {
    id: string;
    email_hash: string;
    created_at: number;
    last_login: number;
    consent_timestamp: number | null;
  };
  backups: Array<{
    id: string;
    createdAt: number;
    meta: unknown;
    blob: string;
  }>;
  migrations: Array<{
    id: string;
    userId: string;
    deviceId: string;
    last_synced_at: number;
  }>;
}

const DEVICE_MIGRATION_ID_KEY = 'fitquest_device_migration_id';

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const json = await res.json();
    if (json && typeof json.error === 'string') return json.error;
  } catch {
    // ignore
  }
  return `Request failed (${res.status})`;
}

async function postJson(path: string, body: unknown, init?: RequestInit): Promise<Response> {
  const baseUrl = requireApiBaseUrl();
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
    body: JSON.stringify(body ?? {}),
    ...init,
  });
}

async function getOrCreateDeviceMigrationId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_MIGRATION_ID_KEY);
  if (existing && existing.trim().length > 0) return existing.trim();

  const bytes = await Crypto.getRandomBytesAsync(16);
  const randomHex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const deviceId = `dev_${randomHex}`;
  await SecureStore.setItemAsync(DEVICE_MIGRATION_ID_KEY, deviceId);
  return deviceId;
}

export async function registerWithEmail(options: {
  email: string;
  password: string;
  name: string;
}): Promise<AuthSessionResponse> {
  const res = await postJson('/auth/email/register', {
    email: options.email,
    password: options.password,
    name: options.name,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return (await res.json()) as AuthSessionResponse;
}

export async function loginWithEmail(options: { email: string; password: string }): Promise<AuthSessionResponse> {
  const res = await postJson('/auth/email/login', {
    email: options.email,
    password: options.password,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return (await res.json()) as AuthSessionResponse;
}

export async function loginWithGoogleIdToken(options: { idToken: string }): Promise<AuthSessionResponse> {
  const idToken = String(options.idToken || '').trim();
  if (!idToken) throw new Error('Missing Google id token');

  const res = await postJson('/auth/google', { idToken });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return (await res.json()) as AuthSessionResponse;
}

export async function loginWithAppleIdToken(options: { idToken: string }): Promise<AuthSessionResponse> {
  const idToken = String(options.idToken || '').trim();
  if (!idToken) throw new Error('Missing Apple id token');

  const res = await postJson('/auth/apple', { idToken });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return (await res.json()) as AuthSessionResponse;
}

export async function refreshWithStoredToken(): Promise<AuthSessionResponse> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error('Missing refresh token');

  const res = await postJson('/auth/refresh', { refreshToken });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  const session = (await res.json()) as AuthSessionResponse;
  await setAuthCredentials(session.accessToken, session.user, session.refreshToken);
  return session;
}

export async function logoutEverywhere(): Promise<void> {
  const refreshToken = await getRefreshToken();
  try {
    if (refreshToken) {
      await postJson('/auth/logout', { refreshToken });
    }
  } finally {
    await clearAuthCredentials();
  }
}

/**
 * Fetch helper that:
 * 1) validates session is still active (30-min timeout)
 * 2) sends current access token
 * 3) if 401, tries a single refresh-rotation then retries once
 * 4) on unrecoverable failure, emits AUTH_FAILURE for forced logout
 *
 * ENFORCEMENT: Every API call goes through here. No bypass.
 */
export async function fetchWithAuth(input: string, init?: RequestInit): Promise<Response> {
  const baseUrl = requireApiBaseUrl();
  const accessToken = await getAuthToken();

  // SESSION TIMEOUT ENFORCEMENT: If no valid token, fail immediately
  if (!accessToken) {
    authEventBus.emit('TOKEN_EXPIRED');
    return new Response(JSON.stringify({ error: 'No auth token' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const doFetch = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (token) headers.authorization = `Bearer ${token}`;
    return fetch(`${baseUrl}${input}`, {
      ...init,
      headers,
    });
  };

  const first = await doFetch(accessToken);
  if (first.status !== 401) return first;

  // Token expired — attempt single refresh
  try {
    await refreshWithStoredToken();
  } catch {
    // Refresh failed — this is an unrecoverable auth failure
    // Emit forced logout — no silent failures allowed
    authEventBus.emit('REFRESH_FAILED');
    return first;
  }

  const newToken = await getAuthToken();
  const retry = await doFetch(newToken);

  // If STILL 401 after refresh — token is fundamentally invalid
  if (retry.status === 401) {
    authEventBus.emit('TOKEN_INVALID');
  }

  return retry;
}

export async function getStoredUser(): Promise<ServerUser | null> {
  const user = await getUserProfile();
  if (!user || typeof user !== 'object') return null;
  const u = user as any;
  if (typeof u.id !== 'string' || typeof u.email !== 'string' || typeof u.name !== 'string') return null;
  return { id: u.id, email: u.email, name: u.name };
}

export async function recordConsentTimestamp(): Promise<{ ok: boolean; consentTimestamp: number }> {
  const res = await fetchWithAuth('/users/consent', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return (await res.json()) as { ok: boolean; consentTimestamp: number };
}

export async function registerMigrationDevice(
  deviceId: string,
): Promise<{ ok: boolean; deviceId: string; last_synced_at: number }> {
  const trimmed = String(deviceId || '').trim();
  if (!trimmed) throw new Error('deviceId is required');

  const res = await fetchWithAuth('/users/migrate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ deviceId: trimmed }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return (await res.json()) as { ok: boolean; deviceId: string; last_synced_at: number };
}

export async function registerCurrentDeviceMigration(): Promise<void> {
  const deviceId = await getOrCreateDeviceMigrationId();
  await registerMigrationDevice(deviceId);
}

export async function exportMyUserData(): Promise<UserDataExport> {
  const res = await fetchWithAuth('/users/export', {
    method: 'GET',
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return (await res.json()) as UserDataExport;
}

export async function deleteMyUserData(): Promise<void> {
  const res = await fetchWithAuth('/users/data', {
    method: 'DELETE',
  });
  if (res.status === 204) {
    await clearAuthCredentials();
    return;
  }
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  await clearAuthCredentials();
}

export async function overwriteBackupBlob(options: {
  id: string;
  blob: string;
  meta?: unknown;
}): Promise<{ id: string; createdAt: number; updatedAt: number }> {
  const res = await fetchWithAuth(`/backups/${encodeURIComponent(options.id)}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      blob: options.blob,
      meta: options.meta,
    }),
  });

  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return (await res.json()) as { id: string; createdAt: number; updatedAt: number };
}
