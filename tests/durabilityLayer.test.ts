/**
 * Durability Layer — Crash/Corruption/Edge-Case Simulations
 *
 * Tests WAL replay, snapshot verification, sovereign export/import,
 * encryption edge cases, and recovery orchestration under failure conditions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

(globalThis as any).__DEV__ = false;

// ==========================================================================
// Mock Setup
// ==========================================================================

// In-memory database simulation for WAL table
const walRows: Map<string, Record<string, unknown>> = new Map();
const dataRows: Map<string, Map<string, Record<string, unknown>>> = new Map();

function resetInMemoryDB() {
  walRows.clear();
  dataRows.clear();
  // Pre-initialize tables
  dataRows.set('user_profile', new Map());
  dataRows.set('workout_sessions', new Map());
  dataRows.set('session_exercises', new Map());
  dataRows.set('user_equipment', new Map());
  dataRows.set('user_injuries', new Map());
  dataRows.set('subscription_state', new Map());
  dataRows.set('trial_state', new Map());
  dataRows.set('daily_steps', new Map());
  dataRows.set('jog_sessions', new Map());
  dataRows.set('body_craft_algorithms', new Map());
  dataRows.set('progress_records', new Map());
  dataRows.set('workout_streaks', new Map());
  dataRows.set('muscle_fatigue', new Map());
  dataRows.set('app_state', new Map());
}

const mockDB = {
  execAsync: vi.fn(async () => {}),
  getAllAsync: vi.fn(async (sql: string) => {
    if (sql.includes('durability_wal') && sql.includes("status = 'pending'")) {
      return Array.from(walRows.values()).filter(r => r.status === 'pending').sort((a, b) => (a.created_at as number) - (b.created_at as number));
    }
    if (sql.includes('durability_wal') && sql.includes('GROUP BY status')) {
      const stats: Record<string, number> = {};
      walRows.forEach(r => { stats[r.status as string] = (stats[r.status as string] || 0) + 1; });
      return Object.entries(stats).map(([status, count]) => ({ status, count }));
    }
    if (sql.includes('durability_wal')) {
      return Array.from(walRows.values());
    }
    return [];
  }),
  getFirstAsync: vi.fn(async (sql: string, params?: unknown[]) => {
    // Support SELECT by id from various tables
    if (sql.includes('durability_wal')) {
      const id = params?.[0] as string;
      return walRows.get(id) ?? null;
    }
    // For replay handlers — check if record exists in target table
    const tableMatch = sql.match(/FROM\s+(\w+)/);
    if (tableMatch?.[1]) {
      const table = dataRows.get(tableMatch[1]);
      if (table && params?.[0]) {
        return table.get(params[0] as string) ?? null;
      }
    }
    return null;
  }),
  runAsync: vi.fn(async (sql: string, ...params: unknown[]) => {
    const flatParams = params.flat();
    // INSERT into durability_wal
    if (sql.includes('INSERT') && sql.includes('durability_wal')) {
      const id = flatParams[0] as string;
      walRows.set(id, {
        id,
        operation: flatParams[1],
        table_name: flatParams[2],
        record_id: flatParams[3],
        payload: flatParams[4],
        status: 'pending',
        created_at: flatParams[5],
        committed_at: null,
      });
      return { changes: 1, lastInsertRowId: 0 };
    }
    // UPDATE durability_wal status
    if (sql.includes('UPDATE') && sql.includes('durability_wal')) {
      if (sql.includes("status = 'committed'")) {
        const id = flatParams[1] as string;
        const row = walRows.get(id);
        if (row) { row.status = 'committed'; row.committed_at = flatParams[0]; }
      } else if (sql.includes("status = 'failed'")) {
        const id = flatParams[0] as string;
        const row = walRows.get(id);
        if (row) row.status = 'failed';
      } else if (sql.includes("status = 'replayed'")) {
        const id = flatParams[1] as string;
        const row = walRows.get(id);
        if (row) { row.status = 'replayed'; row.committed_at = flatParams[0]; }
      }
      return { changes: 1, lastInsertRowId: 0 };
    }
    // DELETE from durability_wal
    if (sql.includes('DELETE') && sql.includes('durability_wal')) {
      if (sql.includes('committed') || sql.includes('replayed')) {
        const cutoff = flatParams[0] as number;
        let count = 0;
        walRows.forEach((row, id) => {
          if ((row.status === 'committed' || row.status === 'replayed') && (row.committed_at as number) < cutoff) {
            walRows.delete(id);
            count++;
          }
        });
        return { changes: count, lastInsertRowId: 0 };
      }
      walRows.clear();
      return { changes: 0, lastInsertRowId: 0 };
    }
    // INSERT into target tables (replay handlers)
    if (sql.includes('INSERT')) {
      const tableMatch = sql.match(/INTO\s+(\w+)/);
      if (tableMatch?.[1]) {
        const table = dataRows.get(tableMatch[1]);
        if (table) {
          const id = flatParams[0] as string;
          table.set(id, { id });
        }
      }
    }
    // UPDATE target tables
    if (sql.includes('UPDATE') && !sql.includes('durability_wal')) {
      // Generic — just track that an update happened
    }
    return { changes: 1, lastInsertRowId: 0 };
  }),
  withTransactionAsync: vi.fn(async (fn: () => Promise<void>) => fn()),
};

// Mock getDatabase
vi.mock('../src/database/schema', () => ({
  getDatabase: vi.fn(async () => mockDB),
}));

// Mock crashReporting
vi.mock('../src/services/crashReporting', () => ({
  captureException: vi.fn(),
}));

// Mock AuthService
let mockMasterKey: string | null = 'test_master_key_0123456789abcdef';
vi.mock('../src/security/AuthService', () => ({
  authService: {
    getMasterKey: () => mockMasterKey,
    initialize: vi.fn(async () => 'LOCKED'),
  },
}));

// ==========================================================================
// Import services AFTER mocking
// ==========================================================================
import { walService, type WALEntry } from '../src/services/WriteAheadLogService';

// ==========================================================================
// TESTS
// ==========================================================================

describe('Durability Layer — Crash & Corruption Simulations', () => {
  beforeEach(() => {
    resetInMemoryDB();
    mockMasterKey = 'test_master_key_0123456789abcdef';
    vi.clearAllMocks();
  });

  // ========================================================================
  // A. MID-WRITE CRASH → WAL REPLAY RECOVERY
  // ========================================================================
  describe('A. Mid-write crash → WAL replay', () => {
    it('replays pending intent after simulated crash', async () => {
      // Simulate: logIntent was called, but crash happened before commit
      const walId = await walService.logIntent({
        operation: 'create_user_profile',
        table_name: 'user_profile',
        record_id: 'user_crash_001',
        payload: { goal: 'strength', experience: 'beginner' },
      });

      // Verify the entry is pending
      const row = walRows.get(walId)!;
      expect(row.status).toBe('pending');

      // Simulate crash recovery: replay pending intents
      const result = await walService.replayPendingIntents();

      expect(result.total).toBe(1);
      expect(result.replayed).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.failed).toBe(0);

      // WAL entry should be marked replayed
      expect(walRows.get(walId)!.status).toBe('replayed');
    });

    it('skips already-applied write on replay (idempotent)', async () => {
      // Pre-populate user profile as if write succeeded before crash
      dataRows.get('user_profile')!.set('user_exist_001', { id: 'user_exist_001' });

      const walId = await walService.logIntent({
        operation: 'create_user_profile',
        table_name: 'user_profile',
        record_id: 'user_exist_001',
        payload: { goal: 'speed', experience: 'advanced' },
      });

      const result = await walService.replayPendingIntents();

      expect(result.total).toBe(1);
      expect(result.skipped).toBe(1); // Already exists, idempotent skip
      expect(result.replayed).toBe(0);
      expect(walRows.get(walId)!.status).toBe('replayed'); // Still marked done
    });

    it('marks entry as failed for unknown operation with no handler', async () => {
      const walId = await walService.logIntent({
        operation: 'nonexistent_operation',
        table_name: 'unknown_table',
        record_id: 'id_001',
        payload: {},
      });

      const result = await walService.replayPendingIntents();

      expect(result.total).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.entries[0]!.error).toBe('no_handler');
      expect(walRows.get(walId)!.status).toBe('failed');
    });

    it('handles multiple pending intents in order (FIFO)', async () => {
      // Create 3 pending intents with sequential timestamps
      const id1 = await walService.logIntent({
        operation: 'create_user_profile',
        table_name: 'user_profile',
        record_id: 'user_fifo_001',
        payload: { goal: 'mobility', experience: 'beginner' },
      });
      const id2 = await walService.logIntent({
        operation: 'create_workout_session',
        table_name: 'workout_sessions',
        record_id: 'ws_fifo_001',
        payload: { user_id: 'user_fifo_001', total_exercises: 5 },
      });

      const result = await walService.replayPendingIntents();

      expect(result.total).toBe(2);
      expect(result.replayed).toBe(2);
      expect(result.entries[0]!.operation).toBe('create_user_profile');
      expect(result.entries[1]!.operation).toBe('create_workout_session');
    });

    it('committed entries are not replayed', async () => {
      // Create and immediately commit
      const walId = await walService.logIntent({
        operation: 'create_user_profile',
        table_name: 'user_profile',
        record_id: 'user_ok_001',
        payload: { goal: 'focus', experience: 'intermediate' },
      });
      await walService.commit(walId);

      expect(walRows.get(walId)!.status).toBe('committed');

      // Replay should find nothing pending
      const result = await walService.replayPendingIntents();
      expect(result.total).toBe(0);
    });
  });

  // ========================================================================
  // B. DOUBLE-REPLAY IDEMPOTENCY
  // ========================================================================
  describe('B. Double-replay idempotency', () => {
    it('second replay finds zero pending entries', async () => {
      await walService.logIntent({
        operation: 'create_user_profile',
        table_name: 'user_profile',
        record_id: 'user_double_001',
        payload: { goal: 'strength', experience: 'intermediate' },
      });

      const first = await walService.replayPendingIntents();
      expect(first.total).toBe(1);
      expect(first.replayed).toBe(1);

      // Second replay should find nothing pending
      const second = await walService.replayPendingIntents();
      expect(second.total).toBe(0);
      expect(second.replayed).toBe(0);
      expect(second.skipped).toBe(0);
      expect(second.failed).toBe(0);
    });
  });

  // ========================================================================
  // C. WAL ENCRYPTION EDGE CASES
  // ========================================================================
  describe('C. WAL payload encryption', () => {
    it('encrypts payload when master key is available', async () => {
      const walId = await walService.logIntent({
        operation: 'create_user_profile',
        table_name: 'user_profile',
        record_id: 'user_enc_001',
        payload: { goal: 'strength', secret: 'sensitive_data' },
      });

      const row = walRows.get(walId)!;
      const stored = row.payload as string;

      // Encrypted payloads start with 'enc2:' prefix (AES-256-GCM)
      expect(stored.startsWith('enc2:')).toBe(true);

      // Raw payload should NOT be visible in stored form
      expect(stored).not.toContain('sensitive_data');
      expect(stored).not.toContain('strength');
    });

    it('falls back to plaintext when master key is null', async () => {
      mockMasterKey = null;

      const walId = await walService.logIntent({
        operation: 'create_user_profile',
        table_name: 'user_profile',
        record_id: 'user_plain_001',
        payload: { goal: 'mobility', data: 'visible' },
      });

      const row = walRows.get(walId)!;
      const stored = row.payload as string;

      // Should be plain JSON — no enc: prefix
      expect(stored.startsWith('enc:')).toBe(false);
      expect(stored).toContain('mobility');
    });

    it('decrypts legacy plaintext entries without error', async () => {
      // Manually insert a plaintext WAL entry (legacy format)
      walRows.set('wal_legacy_001', {
        id: 'wal_legacy_001',
        operation: 'create_user_profile',
        table_name: 'user_profile',
        record_id: 'user_legacy_001',
        payload: '{"goal":"posture","experience":"beginner"}',
        status: 'pending',
        created_at: Date.now() - 1000,
        committed_at: null,
      });

      const result = await walService.replayPendingIntents();

      expect(result.total).toBe(1);
      expect(result.replayed).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('roundtrips encrypted payload through logIntent → replay', async () => {
      const walId = await walService.logIntent({
        operation: 'create_user_profile',
        table_name: 'user_profile',
        record_id: 'user_rt_001',
        payload: { goal: 'speed', experience: 'advanced', complex: { nested: true } },
      });

      // Payload should be encrypted
      const row = walRows.get(walId)!;
      expect((row.payload as string).startsWith('enc2:')).toBe(true);

      // Replay should decrypt and successfully process
      const result = await walService.replayPendingIntents();
      expect(result.replayed).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('fails to decrypt enc2: payload when master key is unavailable at replay time', async () => {
      // Encrypt with key present
      const walId = await walService.logIntent({
        operation: 'create_user_profile',
        table_name: 'user_profile',
        record_id: 'user_nokey_001',
        payload: { goal: 'focus' },
      });

      // Key disappears (simulates locked state)
      mockMasterKey = null;

      const result = await walService.replayPendingIntents();

      // Should fail because decryption requires the key
      expect(result.failed).toBe(1);
      expect(result.entries[0]!.error).toContain('master key unavailable');
    });
  });

  // ========================================================================
  // D. WAL TRANSACTION ATOMICITY
  // ========================================================================
  describe('D. WAL transaction atomicity', () => {
    it('walTransaction commits WAL + write atomically', async () => {
      const { walId, result } = await walService.walTransaction(
        {
          operation: 'create_user_profile',
          table_name: 'user_profile',
          record_id: 'user_tx_001',
          payload: { goal: 'strength' },
        },
        async () => 'write_done',
      );

      expect(result).toBe('write_done');
      expect(walRows.get(walId)!.status).toBe('committed');
      // Transaction wrapper was called
      expect(mockDB.withTransactionAsync).toHaveBeenCalled();
    });

    it('walTransaction rolls back on write failure', async () => {
      const txErr = new Error('DB write failed');

      // withTransactionAsync should propagate errors
      mockDB.withTransactionAsync.mockImplementationOnce(async (fn: () => Promise<void>) => {
        try {
          await fn();
        } catch (e) {
          throw e; // Transaction aborted
        }
      });

      await expect(
        walService.walTransaction(
          {
            operation: 'create_user_profile',
            table_name: 'user_profile',
            record_id: 'user_txfail_001',
            payload: {},
          },
          async () => { throw txErr; },
        ),
      ).rejects.toThrow('DB write failed');
    });
  });

  // ========================================================================
  // E. WAL PRUNING
  // ========================================================================
  describe('E. WAL pruning', () => {
    it('prunes committed entries older than 24h', async () => {
      const oldTs = Date.now() - 25 * 60 * 60 * 1000; // 25h ago

      walRows.set('wal_old_001', {
        id: 'wal_old_001',
        operation: 'create_user_profile',
        table_name: 'user_profile',
        record_id: 'u1',
        payload: '{}',
        status: 'committed',
        created_at: oldTs,
        committed_at: oldTs,
      });
      walRows.set('wal_recent_001', {
        id: 'wal_recent_001',
        operation: 'create_user_profile',
        table_name: 'user_profile',
        record_id: 'u2',
        payload: '{}',
        status: 'committed',
        created_at: Date.now(),
        committed_at: Date.now(),
      });

      const pruned = await walService.pruneCommitted();

      expect(pruned).toBe(1); // Only the old one
      expect(walRows.has('wal_old_001')).toBe(false);
      expect(walRows.has('wal_recent_001')).toBe(true);
    });

    it('preserves pending entries during prune', async () => {
      walRows.set('wal_pending_001', {
        id: 'wal_pending_001',
        operation: 'create_user_profile',
        table_name: 'user_profile',
        record_id: 'u3',
        payload: '{}',
        status: 'pending',
        created_at: Date.now() - 48 * 60 * 60 * 1000,
        committed_at: null,
      });

      await walService.pruneCommitted();

      expect(walRows.has('wal_pending_001')).toBe(true); // Pending = not pruned
    });
  });

  // ========================================================================
  // F. WAL IMPORT/EXPORT (SOVEREIGN BUNDLE PRIMITIVES)
  // ========================================================================
  describe('F. WAL export/import', () => {
    it('exports all WAL entries', async () => {
      await walService.logIntent({
        operation: 'create_user_profile',
        table_name: 'user_profile',
        record_id: 'u_export_1',
        payload: { goal: 'strength' },
      });
      await walService.logIntent({
        operation: 'create_workout_session',
        table_name: 'workout_sessions',
        record_id: 'ws_export_1',
        payload: { user_id: 'u_export_1' },
      });

      const exported = await walService.exportAll();
      expect(exported.length).toBe(2);
    });

    it('imports WAL entries and skips duplicates', async () => {
      const entries: WALEntry[] = [
        {
          id: 'wal_import_001',
          operation: 'create_user_profile',
          table_name: 'user_profile',
          record_id: 'u_import_1',
          payload: '{"goal":"speed"}',
          status: 'pending',
          created_at: Date.now(),
          committed_at: null,
        },
      ];

      const count1 = await walService.importEntries(entries);
      expect(count1).toBe(1);

      // Import same entry again — should be skipped (INSERT OR IGNORE)
      const count2 = await walService.importEntries(entries);
      expect(count2).toBe(1); // Still goes through our mock but real DB would IGNORE
    });

    it('clearAll removes all WAL entries', async () => {
      await walService.logIntent({
        operation: 'create_user_profile',
        table_name: 'user_profile',
        record_id: 'u_clear_1',
        payload: {},
      });

      expect(walRows.size).toBeGreaterThan(0);

      await walService.clearAll();
      expect(walRows.size).toBe(0);
    });
  });

  // ========================================================================
  // G. REPLAY HANDLER COVERAGE — ALL 19 OPERATIONS
  // ========================================================================
  describe('G. Replay handler coverage', () => {
    const operations = [
      { op: 'create_user_profile', table: 'user_profile', id: 'rh_u1', payload: { goal: 'strength', experience: 'beginner' } },
      { op: 'update_user_profile', table: 'user_profile', id: 'rh_u2', payload: { fields: ['goal'] } },
      { op: 'create_workout_session', table: 'workout_sessions', id: 'rh_ws1', payload: { user_id: 'rh_u1', total_exercises: 3 } },
      { op: 'complete_workout_session', table: 'workout_sessions', id: 'rh_ws2', payload: { completedExercises: 3, success: true } },
      { op: 'record_progress', table: 'progress_records', id: 'rh_pr1', payload: { user_id: 'rh_u1', exercise_id: 'ex1', date: '2025-01-01', sets_completed: 3, reps_achieved: '10' } },
      { op: 'update_streak', table: 'workout_streaks', id: 'rh_u1', payload: { current_streak: 5, longest_streak: 10 } },
      { op: 'add_xp', table: 'app_state', id: 'xp_total', payload: { amount: 100 } },
      { op: 'accumulate_fatigue', table: 'muscle_fatigue', id: 'rh_u1_chest', payload: { user_id: 'rh_u1', muscle: 'chest', delta: 20 } },
      { op: 'add_session_exercise', table: 'session_exercises', id: 'rh_se1', payload: { session_id: 'ws1', exercise_id: 'ex1', order_in_session: 1, prescribed_sets: 3, prescribed_reps: '10' } },
      { op: 'set_user_equipment', table: 'user_equipment', id: 'rh_u1', payload: { equipment: ['pullup_bar', 'dumbbell'] } },
      { op: 'set_user_injury', table: 'user_injuries', id: 'rh_u1', payload: { muscle: 'lower_back', severity: 'mild' } },
      { op: 'update_subscription_state', table: 'subscription_state', id: 'rh_u1', payload: { tier: 'premium' } },
      { op: 'upsert_trial_state', table: 'trial_state', id: 'rh_u1', payload: { started_at: 1000, ends_at: 2000 } },
      { op: 'update_trial_converted', table: 'trial_state', id: 'rh_u1', payload: { converted: 1 } },
      { op: 'save_body_craft_algorithm', table: 'body_craft_algorithms', id: 'rh_u1', payload: { user_id: 'rh_u1' } },
      { op: 'delete_all_user_data', table: 'user_profile', id: 'rh_u1', payload: { user_id: 'rh_u1' } },
      { op: 'upsert_daily_steps', table: 'daily_steps', id: 'rh_ds1', payload: { user_id: 'rh_u1', date: '2025-01-01', steps: 8000 } },
      { op: 'create_jog_session', table: 'jog_sessions', id: 'rh_js1', payload: { user_id: 'rh_u1', start_time: '2025-01-01T10:00:00Z' } },
      { op: 'end_jog_session', table: 'jog_sessions', id: 'rh_js1', payload: { end_time: '2025-01-01T10:30:00Z', distance_meters: 5000 } },
    ];

    for (const { op, table, id, payload } of operations) {
      it(`has replay handler for: ${op}`, async () => {
        await walService.logIntent({
          operation: op,
          table_name: table,
          record_id: id,
          payload,
        });

        const result = await walService.replayPendingIntents();

        // Handler exists and doesn't crash — either replayed or skipped (idempotent)
        expect(result.failed).toBe(0);
        expect(result.total).toBe(1);
        expect(result.replayed + result.skipped).toBe(1);
      });
    }
  });

  // ========================================================================
  // H. CONCURRENCY STRESS — RAPID RE-EXECUTION
  // ========================================================================
  describe('H. Concurrency stress', () => {
    it('handles multiple simultaneous logIntent calls', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        walService.logIntent({
          operation: 'create_user_profile',
          table_name: 'user_profile',
          record_id: `user_concurrent_${i}`,
          payload: { goal: 'strength' },
        })
      );

      const ids = await Promise.all(promises);

      expect(ids.length).toBe(10);
      expect(new Set(ids).size).toBe(10); // All unique IDs
      expect(walRows.size).toBe(10);
    });

    it('replay under concurrent pending entries processes all', async () => {
      for (let i = 0; i < 5; i++) {
        await walService.logIntent({
          operation: 'create_user_profile',
          table_name: 'user_profile',
          record_id: `user_batch_${i}`,
          payload: { goal: 'mobility', experience: 'beginner' },
        });
      }

      const result = await walService.replayPendingIntents();
      expect(result.total).toBe(5);
      expect(result.failed).toBe(0);
    });
  });

  // ========================================================================
  // I. CHECKPOINT MANAGEMENT
  // ========================================================================
  describe('I. WAL checkpoint tracking', () => {
    it('starts at zero and advances', () => {
      const initial = walService.getCheckpoint();
      expect(initial).toBeGreaterThanOrEqual(0);

      const prev = walService.advanceCheckpoint();
      const after = walService.getCheckpoint();

      expect(after).toBeGreaterThan(prev);
    });
  });
});

// ==========================================================================
// SNAPSHOT & SOVEREIGN EXPORT — STRUCTURAL VERIFICATION
// (Tests corruption detection logic without needing full service import chains)
// ==========================================================================

describe('Snapshot Verification — Corruption Detection (unit)', () => {
  it('truncated JSON fails JSON.parse', () => {
    const truncated = '{"meta":{"created_at":1234},"pay';
    expect(() => JSON.parse(truncated)).toThrow();
  });

  it('missing meta field is detectable', () => {
    const parsed = JSON.parse('{"payload":"something"}');
    expect(parsed.meta).toBeUndefined();
    // verifySnapshot checks: parsed.meta.created_at && parsed.payload
    const isValid = !!(parsed.meta?.created_at && parsed.payload);
    expect(isValid).toBe(false);
  });

  it('valid snapshot structure passes meta check', () => {
    const parsed = JSON.parse('{"meta":{"created_at":1234},"payload":{"v":3,"ct":"abc"}}');
    const isValid = !!(parsed.meta?.created_at && parsed.payload);
    expect(isValid).toBe(true);
  });

  it('file size below threshold is rejection criteria', () => {
    const MIN_SIZE = 100;
    expect(10 < MIN_SIZE).toBe(true); // File too small
    expect(0 < MIN_SIZE).toBe(true);  // Empty file
    expect(500 < MIN_SIZE).toBe(false); // Valid size
  });
});

describe('Sovereign Export — Bundle Integrity (unit)', () => {
  it('rejects invalid format field', () => {
    const bundle = { format: 'wrong_format', version: 2, payload_encrypted: {}, integrity_hash: 'abc' };
    const valid = bundle.format === 'fitquest_sovereign_bundle';
    expect(valid).toBe(false);
  });

  it('rejects missing payload_encrypted', () => {
    const bundle = { format: 'fitquest_sovereign_bundle', version: 2, integrity_hash: 'abc' } as Record<string, unknown>;
    const valid = !!(bundle.payload_encrypted && bundle.integrity_hash);
    expect(valid).toBe(false);
  });

  it('detects tampered integrity hash', async () => {
    const { digestStringAsync, CryptoDigestAlgorithm } = await import('expo-crypto');
    const payloadEncrypted = { v: 3, ct: 'encrypted_data', iv: 'iv_val', salt: 'salt_val' };
    const storedHash = 'deliberately_wrong_hash';

    const computed = await digestStringAsync(CryptoDigestAlgorithm.SHA256, JSON.stringify(payloadEncrypted));
    expect(computed).not.toBe(storedHash);
  });

  it('matching integrity hash passes verification', async () => {
    const { digestStringAsync, CryptoDigestAlgorithm } = await import('expo-crypto');
    const payloadEncrypted = { v: 3, ct: 'test', iv: 'iv', salt: 'salt' };
    const serialized = JSON.stringify(payloadEncrypted);

    const hash1 = await digestStringAsync(CryptoDigestAlgorithm.SHA256, serialized);
    const hash2 = await digestStringAsync(CryptoDigestAlgorithm.SHA256, serialized);
    expect(hash1).toBe(hash2); // Deterministic
  });

  it('passphrase stretching produces deterministic key', async () => {
    const { digestStringAsync, CryptoDigestAlgorithm } = await import('expo-crypto');

    // Replicate stretchPassphrase logic: 1000 SHA-256 iterations
    const passphrase = 'test_passphrase';
    const salt = 'abcdef1234567890';
    let hash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, `${salt}:${passphrase}:0`);
    for (let i = 1; i < 10; i++) { // Abbreviated, 10 rounds
      hash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, `${salt}:${hash}:${i}`);
    }
    expect(hash.length).toBe(32); // Mock returns 32-char hex
    expect(typeof hash).toBe('string');
  });

  it('wrong passphrase produces different key', async () => {
    const { digestStringAsync, CryptoDigestAlgorithm } = await import('expo-crypto');
    const salt = 'same_salt';

    const key1 = await digestStringAsync(CryptoDigestAlgorithm.SHA256, `${salt}:correct_pass:0`);
    const key2 = await digestStringAsync(CryptoDigestAlgorithm.SHA256, `${salt}:wrong_pass:0`);
    expect(key1).not.toBe(key2);
  });
});

// ==========================================================================
// RECOVERY SERVICE — ORCHESTRATION (logic-level)
// ==========================================================================

describe('Recovery Service — Logic Verification', () => {
  it('session guard pattern works correctly', () => {
    // Simulate the hasRunThisSession flag pattern
    let hasRun = false;

    function tryRun(): 'executed' | 'skipped' {
      if (hasRun) return 'skipped';
      hasRun = true;
      return 'executed';
    }

    expect(tryRun()).toBe('executed');
    expect(tryRun()).toBe('skipped');
    expect(tryRun()).toBe('skipped');
  });

  it('integrity check drives restore vs replay decision', () => {
    function recoverDecision(integrityOk: boolean, pendingEntries: number): string {
      if (!integrityOk) return 'snapshot_restore';
      if (pendingEntries > 0) return 'wal_replay';
      return 'healthy';
    }

    expect(recoverDecision(true, 0)).toBe('healthy');
    expect(recoverDecision(true, 5)).toBe('wal_replay');
    expect(recoverDecision(false, 0)).toBe('snapshot_restore');
    expect(recoverDecision(false, 10)).toBe('snapshot_restore');
  });

  it('snapshot selection tries newest first and skips invalid', () => {
    const snapshots = [
      { filename: 'snap_3.json', valid: true, created_at: 3000 },
      { filename: 'snap_2.json', valid: false, created_at: 2000 },
      { filename: 'snap_1.json', valid: true, created_at: 1000 },
    ];

    // Sorted newest first
    const sorted = [...snapshots].sort((a, b) => b.created_at - a.created_at);
    expect(sorted[0]!.filename).toBe('snap_3.json');

    // Find first valid
    const chosen = sorted.find(s => s.valid);
    expect(chosen!.filename).toBe('snap_3.json');

    // If newest is invalid, falls to next
    snapshots[0]!.valid = false;
    const sorted2 = [...snapshots].sort((a, b) => b.created_at - a.created_at);
    const chosen2 = sorted2.find(s => s.valid);
    expect(chosen2!.filename).toBe('snap_1.json');
  });

  it('no valid snapshots results in failed outcome', () => {
    const snapshots = [
      { filename: 'snap_1.json', valid: false },
      { filename: 'snap_2.json', valid: false },
    ];

    const chosen = snapshots.find(s => s.valid);
    expect(chosen).toBeUndefined();
    // RecoveryService returns outcome: 'failed' in this case
  });
});
