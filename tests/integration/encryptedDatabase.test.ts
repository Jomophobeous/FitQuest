/**
 * Integration Tests: EncryptedDatabaseService + AESEncryption
 *
 * Tests the full encrypt → store → retrieve → decrypt cycle.
 * Only the DB service layer is mocked (in-memory Maps). AES encryption runs for real.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory storage for encrypted rows
const healthStore = new Map<string, any>();
const conversationStore = new Map<string, any>();
const noteStore = new Map<string, any>();
const alertStore = new Map<string, any>();

// Mock database service — stores encrypted blobs in memory
vi.mock('../../src/database/service', () => ({
  insertEncryptedHealthRow: vi.fn().mockImplementation((row: any) => {
    healthStore.set(row.id, row);
    return Promise.resolve();
  }),
  getEncryptedHealthRow: vi.fn().mockImplementation((id: string) => {
    return Promise.resolve(healthStore.get(id) ?? null);
  }),
  getEncryptedHealthRowsByCategory: vi.fn().mockImplementation((category: string) => {
    const rows = Array.from(healthStore.values()).filter((r: any) => r.category === category);
    return Promise.resolve(rows);
  }),
  updateEncryptedHealthRow: vi.fn().mockImplementation((update: any) => {
    const existing = healthStore.get(update.id);
    if (existing) healthStore.set(update.id, { ...existing, ...update });
    return Promise.resolve();
  }),
  getAllEncryptedHealthRows: vi.fn().mockImplementation(() => {
    return Promise.resolve(Array.from(healthStore.values()));
  }),
  insertEncryptedAIConversationRow: vi.fn().mockImplementation((row: any) => {
    conversationStore.set(row.id, row);
    return Promise.resolve();
  }),
  getEncryptedAIConversations: vi.fn().mockImplementation((personality: string) => {
    const rows = Array.from(conversationStore.values()).filter((r: any) => r.personality === personality);
    return Promise.resolve(rows);
  }),
  getAllEncryptedAIConversationRows: vi.fn().mockImplementation(() => {
    return Promise.resolve(Array.from(conversationStore.values()));
  }),
  updateEncryptedAIConversationRow: vi.fn().mockImplementation((update: any) => {
    const existing = conversationStore.get(update.id);
    if (existing) conversationStore.set(update.id, { ...existing, ...update });
    return Promise.resolve();
  }),
  deleteOldAIConversations: vi.fn().mockImplementation((personality: string, before: number) => {
    let deleted = 0;
    for (const [id, row] of conversationStore.entries()) {
      if (row.personality === personality && row.created_at < before) {
        conversationStore.delete(id);
        deleted++;
      }
    }
    return Promise.resolve(deleted);
  }),
  insertEncryptedNoteRow: vi.fn().mockImplementation((row: any) => {
    noteStore.set(row.id, row);
    return Promise.resolve();
  }),
  getEncryptedNoteRow: vi.fn().mockImplementation((id: string) => {
    return Promise.resolve(noteStore.get(id) ?? null);
  }),
  insertHealthAlertRow: vi.fn().mockImplementation((row: any) => {
    alertStore.set(row.id, row);
    return Promise.resolve();
  }),
  getActiveHealthAlertRows: vi.fn().mockImplementation(() => {
    const rows = Array.from(alertStore.values()).filter((r: any) => !r.acknowledged_at);
    return Promise.resolve(rows);
  }),
  acknowledgeHealthAlertRow: vi.fn().mockImplementation((id: string, timestamp: number) => {
    const row = alertStore.get(id);
    if (row) alertStore.set(id, { ...row, acknowledged_at: timestamp });
    return Promise.resolve();
  }),
  secureDeleteEncryptedRow: vi.fn().mockImplementation(({ table, id }: any) => {
    if (table === 'encrypted_health_data') healthStore.delete(id);
    else if (table === 'encrypted_ai_conversations') conversationStore.delete(id);
    else if (table === 'encrypted_notes') noteStore.delete(id);
    else if (table === 'health_alerts') alertStore.delete(id);
    return Promise.resolve();
  }),
}));

import { EncryptedDatabaseService } from '../../src/security/EncryptedDatabase';
import { __reset as resetSecureStore } from '../__mocks__/expo-secure-store';

let db: EncryptedDatabaseService;

beforeEach(async () => {
  healthStore.clear();
  conversationStore.clear();
  noteStore.clear();
  alertStore.clear();
  resetSecureStore();

  // Fresh instance for each test
  db = new EncryptedDatabaseService();
  await db.initialize();
});

// ============================================
// Health Data: Full Roundtrip
// ============================================

describe('Health data encrypt/store/retrieve/decrypt', () => {
  it('stores and retrieves a single health record', async () => {
    const input = { heart_rate: 72, systolic: 120, diastolic: 80 };
    const id = await db.storeHealthData('vitals', input);

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

    const result = await db.getHealthData(id);
    expect(result).toEqual(input);
  });

  it('stores encrypted blob — not plaintext', async () => {
    const secret = { weight_kg: 85.4, body_fat: 22.1 };
    const id = await db.storeHealthData('body_composition', secret);

    // Verify the stored blob is NOT plaintext
    const raw = healthStore.get(id);
    expect(raw.data_blob).not.toContain('85.4');
    expect(raw.data_blob).not.toContain('body_fat');

    // But decrypting returns the original
    const decrypted = await db.getHealthData(id);
    expect(decrypted).toEqual(secret);
  });

  it('retrieves recent health data by category', async () => {
    await db.storeHealthData('vitals', { hr: 68 });
    await db.storeHealthData('vitals', { hr: 72 });
    await db.storeHealthData('sleep', { hours: 7.5 });

    const vitals = await db.getRecentHealthData('vitals');
    expect(vitals).toHaveLength(2);
    expect(vitals.every((v: any) => v.hr)).toBe(true);
  });

  it('returns null for non-existent health record', async () => {
    const result = await db.getHealthData('non_existent_id');
    expect(result).toBeNull();
  });
});

// ============================================
// AI Conversations: Full Roundtrip
// ============================================

describe('AI conversation encrypt/store/retrieve/decrypt', () => {
  it('stores and retrieves a coach conversation', async () => {
    const query = 'How many sets should I do for chest?';
    const response = 'For hypertrophy, aim for 3-4 sets of 8-12 reps.';

    const id = await db.storeAIConversation('COACH', query, response);
    expect(id).toBeTruthy();

    const conversations = await db.getAIConversations('COACH');
    expect(conversations).toHaveLength(1);
    expect(conversations[0]!.query).toBe(query);
    expect(conversations[0]!.response).toBe(response);
  });

  it('stores encrypted — query and response not in plaintext', async () => {
    const query = 'SuperSecretQuestion123';
    const response = 'ConfidentialAnswer456';
    const id = await db.storeAIConversation('PROFESSOR', query, response);

    const raw = conversationStore.get(id);
    expect(raw.query_blob).not.toContain('SuperSecretQuestion123');
    expect(raw.response_blob).not.toContain('ConfidentialAnswer456');
  });

  it('separates COACH and PROFESSOR conversations', async () => {
    await db.storeAIConversation('COACH', 'Q1', 'A1');
    await db.storeAIConversation('PROFESSOR', 'Q2', 'A2');
    await db.storeAIConversation('COACH', 'Q3', 'A3');

    const coach = await db.getAIConversations('COACH');
    const professor = await db.getAIConversations('PROFESSOR');

    expect(coach).toHaveLength(2);
    expect(professor).toHaveLength(1);
  });

  it('preserves metadata', async () => {
    const id = await db.storeAIConversation('COACH', 'Q', 'A', {
      contextDocIds: ['doc1', 'doc2'],
      modelVersion: 'gpt-4',
      tokensUsed: 150,
      processingTimeMs: 450,
    });

    const raw = conversationStore.get(id);
    expect(raw.context_doc_ids).toBe(JSON.stringify(['doc1', 'doc2']));
    expect(raw.model_version).toBe('gpt-4');
    expect(raw.tokens_used).toBe(150);
    expect(raw.processing_time_ms).toBe(450);
  });
});

// ============================================
// Health Alerts
// ============================================

describe('Health alerts encrypt/store/acknowledge', () => {
  it('creates and retrieves an active alert', async () => {
    const alertData = { metric: 'heart_rate', value: 180, threshold: 150 };
    const id = await db.createHealthAlert('ELEVATED_HR', 'HIGH', alertData);
    expect(id).toBeTruthy();

    const alerts = await db.getActiveAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.alertType).toBe('ELEVATED_HR');
    expect(alerts[0]!.severity).toBe('HIGH');
    expect(alerts[0]!.data).toEqual(alertData);
  });

  it('acknowledging removes alert from active list', async () => {
    const id = await db.createHealthAlert('LOW_HR', 'MEDIUM', { bpm: 38 });
    await db.acknowledgeAlert(id);

    const active = await db.getActiveAlerts();
    expect(active).toHaveLength(0);
  });

  it('encrypted alert data is not readable in storage', async () => {
    const sensitive = { bpm: 195, location: 'Emergency' };
    const id = await db.createHealthAlert('CRITICAL_HR', 'CRITICAL', sensitive);

    const raw = alertStore.get(id);
    expect(raw.data_blob).not.toContain('195');
    expect(raw.data_blob).not.toContain('Emergency');
  });
});

// ============================================
// Encrypted Notes
// ============================================

describe('Encrypted notes roundtrip', () => {
  it('stores and retrieves a note', async () => {
    const content = 'Felt very fatigued today. Might need a deload week.';
    const id = await db.storeNote('workout', 'session_001', content);

    const retrieved = await db.getNote(id);
    expect(retrieved).toBe(content);
  });

  it('returns null for non-existent note', async () => {
    const result = await db.getNote('missing_note');
    expect(result).toBeNull();
  });
});

// ============================================
// Secure Delete
// ============================================

describe('Secure delete', () => {
  it('removes health data permanently', async () => {
    const id = await db.storeHealthData('vitals', { hr: 72 });
    expect(healthStore.has(id)).toBe(true);

    await db.secureDelete('encrypted_health_data', id);
    expect(healthStore.has(id)).toBe(false);
  });

  it('rejects invalid table names', async () => {
    await expect(db.secureDelete('users', 'some_id')).rejects.toThrow('invalid table');
  });
});

// ============================================
// Key Rotation Check
// ============================================

describe('Key rotation', () => {
  it('returns false on first check (sets rotation date)', async () => {
    const should = await db.shouldRotateKey();
    expect(should).toBe(false);
  });
});

// ============================================
// Cross-concern: Multiple data types with same key
// ============================================

describe('Cross-data-type consistency', () => {
  it('same encryption key handles health + conversations + notes', async () => {
    const healthId = await db.storeHealthData('sleep', { hours: 8, quality: 'good' });
    const convId = await db.storeAIConversation('COACH', 'Sleep advice?', 'Get 8 hours.');
    const noteId = await db.storeNote('session', 'w1', 'Great sleep last night');

    // All decryptable with the same master key
    const health = await db.getHealthData(healthId);
    expect(health).toEqual({ hours: 8, quality: 'good' });

    const convs = await db.getAIConversations('COACH');
    expect(convs[0]!.query).toBe('Sleep advice?');

    const note = await db.getNote(noteId);
    expect(note).toBe('Great sleep last night');
  });
});
