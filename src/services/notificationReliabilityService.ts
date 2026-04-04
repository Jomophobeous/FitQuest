/**
 * Notification Reliability Service Stub
 * Daily workout reminders — stub for core build.
 */

export interface NotificationReliabilitySettings {
  enabled: boolean;
  reminderHour: number;
  permission: 'granted' | 'denied' | 'unknown';
  lastScheduledAt: string | null;
  lastPromptAt: string | null;
}

export async function getNotificationReliabilitySettings(): Promise<NotificationReliabilitySettings> {
  return { enabled: false, reminderHour: 8, permission: 'unknown', lastScheduledAt: null, lastPromptAt: null };
}

export async function enableDailyWorkoutReminder(_hour: number, _source: string): Promise<void> {}

export async function disableDailyWorkoutReminder(_source: string): Promise<void> {}

export async function setNotificationReminderHour(_hour: number): Promise<void> {}

export async function scheduleDailyWorkoutReminder(_hour: number, _source: string): Promise<void> {}

export function formatReminderHourLabel(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h}:00 ${period}`;
}
