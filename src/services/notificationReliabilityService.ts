import { getAppState, setAppState } from '../database/service';
import { logEvent } from './telemetry';

const KEY_PREFIX = 'notifications.reliability.';
const ENABLED_KEY = `${KEY_PREFIX}enabled`;
const HOUR_KEY = `${KEY_PREFIX}hour`;
const LAST_SCHEDULED_AT_KEY = `${KEY_PREFIX}last_scheduled_at`;
const LAST_PROMPT_AT_KEY = `${KEY_PREFIX}last_prompt_at`;
const LAST_RECONCILED_AT_KEY = `${KEY_PREFIX}last_reconciled_at`;
const LAST_ERROR_KEY = `${KEY_PREFIX}last_error`;
const SCHEDULED_ID_KEY = `${KEY_PREFIX}scheduled_id`;

type PermissionState = 'unknown' | 'granted' | 'denied';
const PERMISSION_KEY = `${KEY_PREFIX}permission`;

export interface NotificationReliabilitySettings {
  enabled: boolean;
  reminderHour: number;
  permission: PermissionState;
  lastScheduledAt: number | null;
  lastPromptAt: number | null;
}

interface ReminderActionResult {
  enabled: boolean;
  permission: PermissionState;
  scheduled: boolean;
  reason?: string;
}

function parseBool(raw: string | null, fallback: boolean): boolean {
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return fallback;
}

function parseIntSafe(raw: string | null, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.floor(value);
}

function parseTimestamp(raw: string | null): number | null {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeHour(input: number): number {
  const hour = Math.floor(input);
  if (hour < 0) return 0;
  if (hour > 23) return 23;
  return hour;
}

function normalizePermission(raw: string | null): PermissionState {
  if (raw === 'granted' || raw === 'denied' || raw === 'unknown') return raw;
  return 'unknown';
}

function mapPermissionStatus(status: unknown): PermissionState {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'unknown';
}

async function getNotificationModule(): Promise<any | null> {
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

async function setLastError(value: string): Promise<void> {
  await setAppState(LAST_ERROR_KEY, value);
}

async function syncPermissionFromSystem(prompt: boolean): Promise<PermissionState> {
  const Notifications = await getNotificationModule();
  if (!Notifications) {
    await setLastError('module_unavailable');
    return 'unknown';
  }

  try {
    const current = typeof Notifications.getPermissionsAsync === 'function'
      ? await Notifications.getPermissionsAsync()
      : null;

    let status = mapPermissionStatus(current?.status);
    if (prompt && status !== 'granted' && typeof Notifications.requestPermissionsAsync === 'function') {
      const requested = await Notifications.requestPermissionsAsync();
      status = mapPermissionStatus(requested?.status);
      await setAppState(LAST_PROMPT_AT_KEY, String(Date.now()));
    }

    await setAppState(PERMISSION_KEY, status);
    await logEvent('notifications_permission_sync', { status, prompt });
    return status;
  } catch {
    await setLastError('permission_sync_failed');
    await logEvent('notifications_permission_sync_failed');
    return 'unknown';
  }
}

export async function getNotificationReliabilitySettings(): Promise<NotificationReliabilitySettings> {
  const [enabledRaw, hourRaw, permissionRaw, lastScheduledRaw, lastPromptRaw] = await Promise.all([
    getAppState(ENABLED_KEY),
    getAppState(HOUR_KEY),
    getAppState(PERMISSION_KEY),
    getAppState(LAST_SCHEDULED_AT_KEY),
    getAppState(LAST_PROMPT_AT_KEY),
  ]);

  return {
    enabled: parseBool(enabledRaw, false),
    reminderHour: normalizeHour(parseIntSafe(hourRaw, 20)),
    permission: normalizePermission(permissionRaw),
    lastScheduledAt: parseTimestamp(lastScheduledRaw),
    lastPromptAt: parseTimestamp(lastPromptRaw),
  };
}

export async function setNotificationReliabilityEnabled(enabled: boolean): Promise<void> {
  await setAppState(ENABLED_KEY, enabled ? '1' : '0');
  await logEvent('notifications_reliability_enabled', { enabled });
}

export async function setNotificationReminderHour(hour: number): Promise<void> {
  const normalized = normalizeHour(hour);
  await setAppState(HOUR_KEY, String(normalized));
  await logEvent('notifications_reliability_hour_set', { hour: normalized });
}

export async function setNotificationPermissionState(permission: PermissionState): Promise<void> {
  await Promise.all([
    setAppState(PERMISSION_KEY, permission),
    setAppState(LAST_PROMPT_AT_KEY, String(Date.now())),
  ]);
  await logEvent('notifications_reliability_permission', { permission });
}

export async function markNotificationReminderScheduled(): Promise<void> {
  await setAppState(LAST_SCHEDULED_AT_KEY, String(Date.now()));
  await logEvent('notifications_reliability_scheduled');
}

export async function scheduleDailyWorkoutReminder(
  hour: number,
  source: 'profile' | 'app_start' | 'background' = 'profile'
): Promise<ReminderActionResult> {
  const normalizedHour = normalizeHour(hour);
  await setNotificationReminderHour(normalizedHour);

  const permission = await syncPermissionFromSystem(false);
  if (permission !== 'granted') {
    await logEvent('notifications_schedule_skipped_no_permission', { source, permission });
    return { enabled: true, permission, scheduled: false, reason: 'permission_not_granted' };
  }

  const Notifications = await getNotificationModule();
  if (!Notifications) {
    await setLastError('module_unavailable');
    await logEvent('notifications_schedule_skipped_no_module', { source });
    return { enabled: true, permission, scheduled: false, reason: 'module_unavailable' };
  }

  try {
    const existingId = await getAppState(SCHEDULED_ID_KEY);
    if (existingId && typeof Notifications.cancelScheduledNotificationAsync === 'function') {
      await Notifications.cancelScheduledNotificationAsync(existingId);
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'FitQuest Reminder',
        body: 'Your daily session is ready. Keep your streak alive.',
        data: { type: 'DAILY_WORKOUT_REMINDER', source },
      },
      trigger: { hour: normalizedHour, minute: 0, repeats: true } as any,
    });

    await Promise.all([
      setAppState(SCHEDULED_ID_KEY, String(identifier || '')),
      setAppState(ENABLED_KEY, '1'),
      setAppState(LAST_ERROR_KEY, ''),
      markNotificationReminderScheduled(),
    ]);

    await logEvent('notifications_daily_scheduled', {
      hour: normalizedHour,
      source,
      identifier: identifier ? String(identifier) : null,
    });
    return { enabled: true, permission, scheduled: true };
  } catch {
    await setLastError('schedule_failed');
    await logEvent('notifications_daily_schedule_failed', { hour: normalizedHour, source });
    return { enabled: true, permission, scheduled: false, reason: 'schedule_failed' };
  }
}

export async function enableDailyWorkoutReminder(
  hour: number,
  source: 'profile' | 'app_start' | 'background' = 'profile'
): Promise<ReminderActionResult> {
  const normalizedHour = normalizeHour(hour);
  await Promise.all([
    setNotificationReliabilityEnabled(true),
    setNotificationReminderHour(normalizedHour),
  ]);

  const permission = await syncPermissionFromSystem(true);
  if (permission !== 'granted') {
    await setLastError('permission_not_granted');
    await logEvent('notifications_enable_pending_permission', { source, permission });
    return { enabled: true, permission, scheduled: false, reason: 'permission_not_granted' };
  }

  return scheduleDailyWorkoutReminder(normalizedHour, source);
}

export async function disableDailyWorkoutReminder(
  source: 'profile' | 'app_start' | 'background' = 'profile'
): Promise<ReminderActionResult> {
  const Notifications = await getNotificationModule();

  if (Notifications) {
    try {
      const existingId = await getAppState(SCHEDULED_ID_KEY);
      if (existingId && typeof Notifications.cancelScheduledNotificationAsync === 'function') {
        await Notifications.cancelScheduledNotificationAsync(existingId);
      }
    } catch {
      await setLastError('cancel_failed');
      await logEvent('notifications_cancel_failed', { source });
    }
  }

  const permission = await syncPermissionFromSystem(false);
  await Promise.all([
    setAppState(ENABLED_KEY, '0'),
    setAppState(SCHEDULED_ID_KEY, ''),
  ]);
  await logEvent('notifications_daily_disabled', { source });
  return { enabled: false, permission, scheduled: false };
}

export async function reconcileNotificationReliability(
  source: 'app_start' | 'background' | 'profile' = 'app_start',
  maxScheduleAgeMs: number = 20 * 60 * 60 * 1000
): Promise<ReminderActionResult | null> {
  const settings = await getNotificationReliabilitySettings();
  await setAppState(LAST_RECONCILED_AT_KEY, String(Date.now()));

  if (!settings.enabled) {
    await logEvent('notifications_reconcile_skip_disabled', { source });
    return null;
  }

  const stale =
    settings.lastScheduledAt == null || Date.now() - settings.lastScheduledAt > Math.max(maxScheduleAgeMs, 0);

  if (!stale) {
    await logEvent('notifications_reconcile_skip_fresh', {
      source,
      lastScheduledAt: settings.lastScheduledAt,
    });
    return {
      enabled: true,
      permission: settings.permission,
      scheduled: true,
      reason: 'schedule_fresh',
    };
  }

  return scheduleDailyWorkoutReminder(settings.reminderHour, source === 'profile' ? 'profile' : 'app_start');
}

export function formatReminderHourLabel(hour: number): string {
  const normalized = normalizeHour(hour);
  return `${String(normalized).padStart(2, '0')}:00`;
}
