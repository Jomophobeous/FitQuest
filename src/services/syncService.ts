import * as Crypto from 'expo-crypto';

import { getApiBaseUrl } from './apiBaseUrl';
import { fetchWithAuth } from './authApi';
import { isCloudBackupConfigured, uploadLocalBackupToCloud } from './cloudBackupService';
import { getAppState, getMuscleFatigue, getRecentSessions, getUserProfile, setAppState } from '../database/service';
import { enqueueMutation } from './mutationQueueService';

const SYNC_VERSION_KEY = 'sync.state.version';
const SYNC_HASH_KEY = 'sync.state.hash';

export interface SyncStateMeta {
  userId?: string;
  version: number;
  base_hash: string;
  state_hash: string;
  backup_id?: string | null;
  device_id?: string | null;
  updated_at?: number;
}

export interface SyncOutcomeEvent {
  id: string;
  event_type: string;
  occurred_at: number;
  device_id?: string | null;
  state_version?: number | null;
  payload: Record<string, unknown>;
}

export interface SyncDecision {
  action: 'noop' | 'upload_local' | 'server_newer' | 'conflict';
  local: SyncStateMeta;
  remote: SyncStateMeta | null;
}

function isSyncConfigured(): boolean {
  return getApiBaseUrl() !== null;
}

async function digestObject(input: unknown): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    JSON.stringify(input)
  );
}

function parseNumber(value: string | null, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

export function mergeEventsById(
  localEvents: SyncOutcomeEvent[],
  remoteEvents: SyncOutcomeEvent[]
): SyncOutcomeEvent[] {
  const out = new Map<string, SyncOutcomeEvent>();
  for (const event of [...localEvents, ...remoteEvents]) {
    if (!event?.id) continue;
    out.set(event.id, event);
  }
  return Array.from(out.values()).sort((a, b) => a.occurred_at - b.occurred_at);
}

export async function getLatestStateMeta(): Promise<SyncStateMeta | null> {
  if (!isSyncConfigured()) return null;
  const res = await fetchWithAuth('/sync/state-meta/latest', { method: 'GET' });
  if (!res.ok) throw new Error(`[Sync] latest state meta failed (${res.status})`);
  const json = (await res.json()) as { state_meta?: SyncStateMeta | null };
  return json.state_meta ?? null;
}

export async function upsertStateMeta(input: {
  version: number;
  base_hash: string;
  state_hash: string;
  backup_id?: string | null;
  device_id?: string | null;
}): Promise<SyncStateMeta> {
  if (!isSyncConfigured()) throw new Error('[Sync] EXPO_PUBLIC_API_BASE_URL is not configured');

  const res = await fetchWithAuth('/sync/state-meta', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[Sync] upsert state meta failed (${res.status}) ${body}`);
  }

  const json = (await res.json()) as { state_meta: SyncStateMeta };
  return json.state_meta;
}

export async function appendOutcomeEvents(events: SyncOutcomeEvent[]): Promise<{
  accepted_count: number;
  skipped_count: number;
}> {
  if (!isSyncConfigured()) throw new Error('[Sync] EXPO_PUBLIC_API_BASE_URL is not configured');
  const res = await fetchWithAuth('/sync/events', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ events }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[Sync] append events failed (${res.status}) ${body}`);
  }

  const json = (await res.json()) as { accepted_count: number; skipped_count: number };
  return {
    accepted_count: json.accepted_count ?? 0,
    skipped_count: json.skipped_count ?? 0,
  };
}

export async function fetchOutcomeEvents(since = 0, limit = 200): Promise<SyncOutcomeEvent[]> {
  if (!isSyncConfigured()) return [];
  const res = await fetchWithAuth(`/sync/events?since=${Math.max(0, Math.floor(since))}&limit=${Math.max(1, Math.floor(limit))}`, {
    method: 'GET',
  });
  if (!res.ok) throw new Error(`[Sync] fetch events failed (${res.status})`);
  const json = (await res.json()) as { events?: Array<Record<string, unknown>> };

  return (json.events || []).map((event) => ({
    id: String(event.id || ''),
    event_type: String(event.event_type || ''),
    occurred_at: Number(event.occurredAt || event.occurred_at || Date.now()),
    device_id: typeof event.device_id === 'string' ? event.device_id : null,
    state_version: typeof event.state_version === 'number' ? event.state_version : null,
    payload: (event.payload && typeof event.payload === 'object') ? (event.payload as Record<string, unknown>) : {},
  }));
}

export async function buildLocalStateMeta(userId = 'user_local_001'): Promise<SyncStateMeta> {
  const profile = await getUserProfile(userId);
  const fatigue = await getMuscleFatigue(userId);
  const recentSessions = await getRecentSessions(userId, 14);

  const statePayload = {
    profile: profile
      ? {
          id: profile.id,
          goal: profile.goal,
          experience: profile.experience,
          training_days_per_week: profile.training_days_per_week,
          time_per_session_minutes: profile.time_per_session_minutes,
          updated_at: profile.updated_at,
        }
      : null,
    fatigue: fatigue
      .map((entry) => ({ muscle: entry.muscle, fatigue_level: entry.fatigue_level, updated_at: entry.updated_at }))
      .sort((a, b) => a.muscle.localeCompare(b.muscle)),
    sessions: recentSessions
      .map((session) => ({ id: session.id, started_at: session.started_at, completed_at: session.completed_at, success: session.success }))
      .sort((a, b) => a.started_at.localeCompare(b.started_at)),
  };

  const stateHash = await digestObject(statePayload);
  const storedVersion = parseNumber(await getAppState(SYNC_VERSION_KEY), 0);
  const storedHash = (await getAppState(SYNC_HASH_KEY)) || '';
  const nextVersion = storedHash && storedHash !== stateHash ? storedVersion + 1 : Math.max(1, storedVersion || 1);
  const baseHash = storedHash || stateHash;

  return {
    version: nextVersion,
    base_hash: baseHash,
    state_hash: stateHash,
  };
}

export async function syncOnDemand(options?: {
  userId?: string;
  deviceId?: string;
}): Promise<SyncDecision> {
  const effectiveUserId = options?.userId || 'user_local_001';
  const effectiveDeviceId = options?.deviceId || null;

  if (!isSyncConfigured()) {
    throw new Error('[Sync] EXPO_PUBLIC_API_BASE_URL is not configured');
  }

  try {
    const local = await buildLocalStateMeta(effectiveUserId);
    const remote = await getLatestStateMeta();

    if (!remote) {
      let backupId: string | null = null;
      if (isCloudBackupConfigured()) {
        const uploaded = await uploadLocalBackupToCloud();
        backupId = uploaded.id;
      }

      const saved = await upsertStateMeta({
        ...local,
        backup_id: backupId,
        device_id: effectiveDeviceId,
      });

      await setAppState(SYNC_VERSION_KEY, String(saved.version));
      await setAppState(SYNC_HASH_KEY, saved.state_hash);

      return {
        action: 'upload_local',
        local: saved,
        remote: null,
      };
    }

    if (remote.version > local.version) {
      return {
        action: 'server_newer',
        local,
        remote,
      };
    }

    if (remote.version === local.version && remote.state_hash !== local.state_hash) {
      return {
        action: 'conflict',
        local,
        remote,
      };
    }

    if (remote.version === local.version && remote.state_hash === local.state_hash) {
      await setAppState(SYNC_VERSION_KEY, String(remote.version));
      await setAppState(SYNC_HASH_KEY, remote.state_hash);
      return {
        action: 'noop',
        local,
        remote,
      };
    }

    const saved = await upsertStateMeta({
      ...local,
      backup_id: remote.backup_id || null,
      device_id: effectiveDeviceId || remote.device_id || null,
    });

    await setAppState(SYNC_VERSION_KEY, String(saved.version));
    await setAppState(SYNC_HASH_KEY, saved.state_hash);

    return {
      action: 'upload_local',
      local: saved,
      remote,
    };
  } catch (error) {
    await enqueueMutation(
      'sync.on_demand',
      { userId: effectiveUserId, deviceId: effectiveDeviceId },
      { dedupeKey: `sync.on_demand.${effectiveUserId}.${effectiveDeviceId || 'default'}` },
    );
    throw error;
  }
}
