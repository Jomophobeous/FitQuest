/**
 * SERVICE — Smart Defaults
 *
 * Learns from user patterns and provides intelligent defaults.
 * All data stored in app_state KV store — no new tables.
 *
 * Tracks:
 * - Last workout category used
 * - Preferred session duration (rolling average)
 * - Last workout time-of-day preference
 * - Last used equipment set
 *
 * Consumers: create-workout form prefill, workout generation hints.
 */

import { getAppState, setAppState } from '../database/service';

const PREFIX = 'smart_defaults.';

// ============================================
// TYPES
// ============================================

export interface SmartDefaults {
  /** Last workout category (body_control, posture, etc.) */
  lastCategory: string | null;
  /** Average preferred duration in minutes */
  preferredDuration: number;
  /** Time-of-day tendency: morning, afternoon, evening */
  preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | null;
  /** Last used equipment items (JSON array) */
  lastEquipment: string[];
}

// ============================================
// READ
// ============================================

export async function getSmartDefaults(): Promise<SmartDefaults> {
  const [cat, dur, tod, equip] = await Promise.all([
    getAppState(`${PREFIX}last_category`).catch(() => null),
    getAppState(`${PREFIX}avg_duration`).catch(() => null),
    getAppState(`${PREFIX}time_of_day`).catch(() => null),
    getAppState(`${PREFIX}last_equipment`).catch(() => null),
  ]);

  return {
    lastCategory: cat,
    preferredDuration: dur ? Number(dur) || 30 : 30,
    preferredTimeOfDay: (tod as SmartDefaults['preferredTimeOfDay']) ?? null,
    lastEquipment: equip ? safeParseArray(equip) : [],
  };
}

// ============================================
// WRITE — call after workout completion
// ============================================

export async function recordWorkoutPattern(params: {
  category?: string;
  durationMinutes: number;
  equipment?: string[];
}): Promise<void> {
  const updates: Promise<void>[] = [];

  if (params.category) {
    updates.push(setAppState(`${PREFIX}last_category`, params.category));
  }

  // Rolling average duration (simple exponential: 70% new, 30% old)
  const prev = await getAppState(`${PREFIX}avg_duration`).catch(() => null);
  const prevDur = prev ? Number(prev) || 30 : 30;
  const newDur = Math.round(params.durationMinutes * 0.7 + prevDur * 0.3);
  updates.push(setAppState(`${PREFIX}avg_duration`, String(newDur)));

  // Time of day
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  updates.push(setAppState(`${PREFIX}time_of_day`, timeOfDay));

  // Equipment
  if (params.equipment && params.equipment.length > 0) {
    updates.push(setAppState(`${PREFIX}last_equipment`, JSON.stringify(params.equipment)));
  }

  await Promise.all(updates);
}

// ============================================
// HELPERS
// ============================================

function safeParseArray(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
