/**
 * SERVICE — Debug Buffer (Phase 19)
 *
 * In-memory ring buffer for real-time system observability.
 * Dev-only. Zero production impact — all writes short-circuit when __DEV__ is false.
 *
 * Collects:
 *   - Telemetry events (logEvent calls)
 *   - SQLite write operations
 *   - Navigation route changes
 *   - InteractionManager executions
 *   - Network/sync activity
 *
 * Consumed by DebugPanel screen.
 */

// ============================================
// TYPES
// ============================================

export type DebugEntryType = 'event' | 'db_write' | 'navigation' | 'interaction' | 'network' | 'sync';

export interface DebugEntry {
  id: number;
  type: DebugEntryType;
  label: string;
  payload?: Record<string, unknown>;
  timestamp: number;
}

// ============================================
// RING BUFFER
// ============================================

const MAX_ENTRIES = 100;
let _buffer: DebugEntry[] = [];
let _seq = 0;
let _listeners: Array<() => void> = [];

function push(type: DebugEntryType, label: string, payload?: Record<string, unknown>): void {
  if (!__DEV__) return;
  _seq += 1;
  _buffer.push({ id: _seq, type, label, payload, timestamp: Date.now() });
  if (_buffer.length > MAX_ENTRIES) _buffer = _buffer.slice(-MAX_ENTRIES);
  for (const fn of _listeners) fn();
}

// ============================================
// PUBLIC API
// ============================================

/** Record a telemetry event (call from logEvent). */
export function debugLogEvent(name: string, data?: Record<string, unknown>): void {
  push('event', name, data);
}

/** Record a SQLite write operation. */
export function debugLogDbWrite(operation: string, table: string, detail?: Record<string, unknown>): void {
  push('db_write', `${operation} → ${table}`, detail);
}

/** Record a navigation route change. */
export function debugLogNavigation(route: string, action: 'push' | 'replace' | 'back'): void {
  push('navigation', `${action}: ${route}`);
}

/** Record an InteractionManager execution. */
export function debugLogInteraction(actionId: string, executed: boolean): void {
  push('interaction', actionId, { executed });
}

/** Record a network/sync event. */
export function debugLogNetwork(label: string, detail?: Record<string, unknown>): void {
  push('network', label, detail);
}

/** Record a sync engine event. */
export function debugLogSync(label: string, detail?: Record<string, unknown>): void {
  push('sync', label, detail);
}

// ============================================
// CONSUMERS
// ============================================

/** Get all entries (latest last). */
export function getDebugEntries(): DebugEntry[] {
  return _buffer;
}

/** Get entries filtered by type. */
export function getDebugEntriesByType(type: DebugEntryType): DebugEntry[] {
  return _buffer.filter((e) => e.type === type);
}

/** Subscribe to buffer changes. Returns unsubscribe function. */
export function subscribeDebugBuffer(fn: () => void): () => void {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter((f) => f !== fn);
  };
}

/** Clear all entries. */
export function clearDebugBuffer(): void {
  _buffer = [];
  _seq = 0;
  for (const fn of _listeners) fn();
}
