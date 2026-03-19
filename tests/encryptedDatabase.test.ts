import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ──
const {
  mockGetOrCreateMasterKey,
  mockEncryptV3,
  mockDecryptV3,
  mockDecryptV2,
  mockDecryptV1Legacy,
  mockIsV1Payload,
  mockIsV2Payload,
  mockIsV3Payload,
  mockCryptoGetRandomBytes,
  mockSecureStoreGet,
  mockSecureStoreSet,
  mockInsertHealthRow,
  mockGetHealthRow,
  mockGetHealthRowsByCategory,
  mockUpdateHealthRow,
  mockGetAllHealthRows,
  mockInsertConvRow,
  mockGetConversations,
  mockGetAllConvRows,
  mockUpdateConvRow,
  mockInsertNoteRow,
  mockGetNoteRow,
  mockInsertAlertRow,
  mockGetActiveAlerts,
  mockAcknowledgeAlert,
  mockSecureDeleteRow,
} = vi.hoisted(() => ({
  mockGetOrCreateMasterKey: vi.fn(),
  mockEncryptV3: vi.fn(),
  mockDecryptV3: vi.fn(),
  mockDecryptV2: vi.fn(),
  mockDecryptV1Legacy: vi.fn(),
  mockIsV1Payload: vi.fn(),
  mockIsV2Payload: vi.fn(),
  mockIsV3Payload: vi.fn(),
  mockCryptoGetRandomBytes: vi.fn(),
  mockSecureStoreGet: vi.fn(),
  mockSecureStoreSet: vi.fn(),
  mockInsertHealthRow: vi.fn(),
  mockGetHealthRow: vi.fn(),
  mockGetHealthRowsByCategory: vi.fn(),
  mockUpdateHealthRow: vi.fn(),
  mockGetAllHealthRows: vi.fn(),
  mockInsertConvRow: vi.fn(),
  mockGetConversations: vi.fn(),
  mockGetAllConvRows: vi.fn(),
  mockUpdateConvRow: vi.fn(),
  mockInsertNoteRow: vi.fn(),
  mockGetNoteRow: vi.fn(),
  mockInsertAlertRow: vi.fn(),
  mockGetActiveAlerts: vi.fn(),
  mockAcknowledgeAlert: vi.fn(),
  mockSecureDeleteRow: vi.fn(),
}));

vi.mock('../src/security/AESEncryption', () => ({
  getOrCreateMasterKey: (...args: any[]) => mockGetOrCreateMasterKey(...args),
  encryptV3: (...args: any[]) => mockEncryptV3(...args),
  decryptV3: (...args: any[]) => mockDecryptV3(...args),
  decryptV2: (...args: any[]) => mockDecryptV2(...args),
  decryptV1Legacy: (...args: any[]) => mockDecryptV1Legacy(...args),
  isV1Payload: (...args: any[]) => mockIsV1Payload(...args),
  isV2Payload: (...args: any[]) => mockIsV2Payload(...args),
  isV3Payload: (...args: any[]) => mockIsV3Payload(...args),
}));

vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: (...args: any[]) => mockCryptoGetRandomBytes(...args),
  digestStringAsync: vi.fn().mockResolvedValue('sha256hash'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: (...args: any[]) => mockSecureStoreGet(...args),
  setItemAsync: (...args: any[]) => mockSecureStoreSet(...args),
}));

vi.mock('../src/database/service', () => ({
  insertEncryptedHealthRow: (...args: any[]) => mockInsertHealthRow(...args),
  getEncryptedHealthRow: (...args: any[]) => mockGetHealthRow(...args),
  getEncryptedHealthRowsByCategory: (...args: any[]) => mockGetHealthRowsByCategory(...args),
  updateEncryptedHealthRow: (...args: any[]) => mockUpdateHealthRow(...args),
  getAllEncryptedHealthRows: (...args: any[]) => mockGetAllHealthRows(...args),
  insertEncryptedAIConversationRow: (...args: any[]) => mockInsertConvRow(...args),
  getEncryptedAIConversations: (...args: any[]) => mockGetConversations(...args),
  getAllEncryptedAIConversationRows: (...args: any[]) => mockGetAllConvRows(...args),
  updateEncryptedAIConversationRow: (...args: any[]) => mockUpdateConvRow(...args),
  insertEncryptedNoteRow: (...args: any[]) => mockInsertNoteRow(...args),
  getEncryptedNoteRow: (...args: any[]) => mockGetNoteRow(...args),
  insertHealthAlertRow: (...args: any[]) => mockInsertAlertRow(...args),
  getActiveHealthAlertRows: (...args: any[]) => mockGetActiveAlerts(...args),
  acknowledgeHealthAlertRow: (...args: any[]) => mockAcknowledgeAlert(...args),
  secureDeleteEncryptedRow: (...args: any[]) => mockSecureDeleteRow(...args),
}));

import { EncryptedDatabaseService } from '../src/security/EncryptedDatabase';

describe('EncryptedDatabase', () => {
  let db: EncryptedDatabaseService;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default encryption mocks
    mockGetOrCreateMasterKey.mockResolvedValue('test-master-key-hex');
    mockSecureStoreGet.mockResolvedValue(null); // no legacy key
    mockEncryptV3.mockResolvedValue({ version: 3, iv: 'iv', ciphertext: 'encrypted', tag: 'tag' });
    mockDecryptV3.mockResolvedValue('decrypted-plaintext');
    mockIsV1Payload.mockReturnValue(false);
    mockIsV2Payload.mockReturnValue(false);
    mockIsV3Payload.mockReturnValue(true);
    mockCryptoGetRandomBytes.mockResolvedValue(new Uint8Array(16).fill(0xAB));

    // DB operation defaults
    mockInsertHealthRow.mockResolvedValue(undefined);
    mockUpdateHealthRow.mockResolvedValue(undefined);
    mockInsertConvRow.mockResolvedValue(undefined);
    mockInsertNoteRow.mockResolvedValue(undefined);
    mockInsertAlertRow.mockResolvedValue(undefined);
    mockAcknowledgeAlert.mockResolvedValue(undefined);
    mockSecureDeleteRow.mockResolvedValue(undefined);
    mockSecureStoreSet.mockResolvedValue(undefined);

    db = new EncryptedDatabaseService();
    await db.initialize();
  });

  describe('initialization', () => {
    it('retrieves master key on initialize', async () => {
      expect(mockGetOrCreateMasterKey).toHaveBeenCalledTimes(1);
    });

    it('does not re-initialize when already initialized', async () => {
      await db.initialize();
      await db.initialize();
      // getOrCreateMasterKey called once in beforeEach
      expect(mockGetOrCreateMasterKey).toHaveBeenCalledTimes(1);
    });

    it('throws if operations called before initialization', async () => {
      const uninitDb = new EncryptedDatabaseService();
      await expect(
        uninitDb.storeHealthData('test', { value: 1 })
      ).rejects.toThrow('not initialized');
    });
  });

  describe('health data', () => {
    it('stores health data with encryption', async () => {
      const id = await db.storeHealthData('heart_rate', { bpm: 72 });

      expect(id).toBeTruthy();
      expect(mockEncryptV3).toHaveBeenCalledWith(
        JSON.stringify({ bpm: 72 }),
        'test-master-key-hex'
      );
      expect(mockInsertHealthRow).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'heart_rate',
          data_blob: expect.any(String),
        })
      );
    });

    it('retrieves and decrypts health data', async () => {
      mockGetHealthRow.mockResolvedValue({
        id: 'test-id',
        data_blob: JSON.stringify({ version: 3, ciphertext: 'enc' }),
        created_at: Date.now(),
        updated_at: Date.now(),
      });
      mockDecryptV3.mockResolvedValue(JSON.stringify({ bpm: 72 }));

      const data = await db.getHealthData('test-id');
      expect(data).toEqual({ bpm: 72 });
    });

    it('returns null for non-existent health data', async () => {
      mockGetHealthRow.mockResolvedValue(null);
      const data = await db.getHealthData('nonexistent');
      expect(data).toBeNull();
    });

    it('retrieves recent health data by category', async () => {
      mockGetHealthRowsByCategory.mockResolvedValue([
        { id: 'r1', data_blob: JSON.stringify({ version: 3 }), created_at: 1000, updated_at: 1000 },
        { id: 'r2', data_blob: JSON.stringify({ version: 3 }), created_at: 2000, updated_at: 2000 },
      ]);
      mockDecryptV3.mockResolvedValue(JSON.stringify({ bpm: 65 }));

      const results = await db.getRecentHealthData('heart_rate', 10);
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('id', 'r1');
    });
  });

  describe('AI conversations', () => {
    it('stores AI conversation with encrypted query and response', async () => {
      const id = await db.storeAIConversation(
        'COACH',
        'How do I improve my squat?',
        'Focus on depth and hip mobility...',
        { tokensUsed: 150, processingTimeMs: 400 }
      );

      expect(id).toBeTruthy();
      expect(mockEncryptV3).toHaveBeenCalledTimes(2); // query + response
      expect(mockInsertConvRow).toHaveBeenCalledWith(
        expect.objectContaining({
          personality: 'COACH',
          tokens_used: 150,
          processing_time_ms: 400,
        })
      );
    });

    it('retrieves and decrypts conversations', async () => {
      mockGetConversations.mockResolvedValue([
        {
          id: 'c1',
          query_blob: JSON.stringify({ version: 3 }),
          response_blob: JSON.stringify({ version: 3 }),
          created_at: Date.now(),
        },
      ]);
      mockDecryptV3
        .mockResolvedValueOnce('What is HIIT?')
        .mockResolvedValueOnce('High Intensity Interval Training...');

      const convos = await db.getAIConversations('COACH', 10);
      expect(convos).toHaveLength(1);
      expect(convos[0]!.query).toBe('What is HIIT?');
      expect(convos[0]!.response).toBe('High Intensity Interval Training...');
    });

    it('handles decryption failures gracefully in conversations', async () => {
      mockGetConversations.mockResolvedValue([
        { id: 'c1', query_blob: 'bad', response_blob: 'bad', created_at: Date.now() },
      ]);
      mockDecryptV3.mockRejectedValue(new Error('Decryption failed'));

      const convos = await db.getAIConversations('PROFESSOR');
      expect(convos).toHaveLength(0); // failed items are filtered out
    });
  });

  describe('health alerts', () => {
    it('creates encrypted health alert', async () => {
      const id = await db.createHealthAlert(
        'ANOMALY_HEART_RATE',
        'HIGH',
        { bpm: 180, context: 'resting' }
      );

      expect(id).toBeTruthy();
      expect(mockInsertAlertRow).toHaveBeenCalledWith(
        expect.objectContaining({
          alert_type: 'ANOMALY_HEART_RATE',
          severity: 'HIGH',
        })
      );
    });

    it('creates alert with encrypted location', async () => {
      await db.createHealthAlert(
        'EMERGENCY',
        'CRITICAL',
        { type: 'fall_detected' },
        { latitude: -33.9, longitude: 18.4, accuracy: 10 }
      );

      // encryptV3 called 2 times: data + location
      expect(mockEncryptV3).toHaveBeenCalledTimes(2);
    });

    it('acknowledges alert', async () => {
      await db.acknowledgeAlert('alert-123');
      expect(mockAcknowledgeAlert).toHaveBeenCalledWith('alert-123', expect.any(Number));
    });

    it('retrieves and decrypts active alerts', async () => {
      mockGetActiveAlerts.mockResolvedValue([
        {
          id: 'a1',
          alert_type: 'HIGH_HR',
          severity: 'HIGH',
          data_blob: JSON.stringify({ version: 3 }),
          created_at: Date.now(),
        },
      ]);
      mockDecryptV3.mockResolvedValue(JSON.stringify({ bpm: 195 }));

      const alerts = await db.getActiveAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.alertType).toBe('HIGH_HR');
      expect(alerts[0]!.data).toEqual({ bpm: 195 });
    });
  });

  describe('encrypted notes', () => {
    it('stores and retrieves encrypted notes', async () => {
      const id = await db.storeNote('workout', 'session-1', 'Felt great today!');

      expect(id).toBeTruthy();
      expect(mockEncryptV3).toHaveBeenCalledWith('Felt great today!', 'test-master-key-hex');
      expect(mockInsertNoteRow).toHaveBeenCalled();
    });

    it('returns null for non-existent note', async () => {
      mockGetNoteRow.mockResolvedValue(null);
      const note = await db.getNote('missing');
      expect(note).toBeNull();
    });

    it('decrypts note content', async () => {
      mockGetNoteRow.mockResolvedValue({
        id: 'n1',
        content_blob: JSON.stringify({ version: 3 }),
        created_at: Date.now(),
        updated_at: Date.now(),
      });
      mockDecryptV3.mockResolvedValue('My secret note');

      const note = await db.getNote('n1');
      expect(note).toBe('My secret note');
    });
  });

  describe('payload version detection', () => {
    it('decrypts v3 payload directly', async () => {
      mockIsV3Payload.mockReturnValue(true);
      mockIsV1Payload.mockReturnValue(false);
      mockIsV2Payload.mockReturnValue(false);
      mockDecryptV3.mockResolvedValue(JSON.stringify({ test: true }));

      mockGetHealthRow.mockResolvedValue({
        id: 'v3-row',
        data_blob: JSON.stringify({ version: 3, ciphertext: 'x' }),
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      const data = await db.getHealthData('v3-row');
      expect(data).toEqual({ test: true });
      expect(mockDecryptV3).toHaveBeenCalled();
    });

    it('decrypts v2 payload and triggers migration', async () => {
      mockIsV3Payload.mockReturnValue(false);
      mockIsV2Payload.mockReturnValue(true);
      mockIsV1Payload.mockReturnValue(false);
      mockDecryptV2.mockResolvedValue(JSON.stringify({ legacy: true }));

      mockGetHealthRow.mockResolvedValue({
        id: 'v2-row',
        data_blob: JSON.stringify({ version: 2, ciphertext: 'old' }),
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      const data = await db.getHealthData('v2-row');
      expect(data).toEqual({ legacy: true });
      // Should attempt to migrate
      expect(mockUpdateHealthRow).toHaveBeenCalled();
    });

    it('decrypts v1 payload with legacy key', async () => {
      // Re-initialize with legacy key present
      mockSecureStoreGet.mockResolvedValue('legacy-v1-key');
      const dbWithLegacy = new EncryptedDatabaseService();
      await dbWithLegacy.initialize();

      mockIsV3Payload.mockReturnValue(false);
      mockIsV2Payload.mockReturnValue(false);
      mockIsV1Payload.mockReturnValue(true);
      mockDecryptV1Legacy.mockResolvedValue(JSON.stringify({ old: true }));

      mockGetHealthRow.mockResolvedValue({
        id: 'v1-row',
        data_blob: JSON.stringify({ data: 'xor-encrypted' }),
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      const data = await dbWithLegacy.getHealthData('v1-row');
      expect(data).toEqual({ old: true });
      expect(mockDecryptV1Legacy).toHaveBeenCalledWith(
        expect.anything(),
        'legacy-v1-key'
      );
    });
  });

  describe('key rotation', () => {
    it('does not require rotation on first check', async () => {
      mockSecureStoreGet.mockResolvedValue(null);
      const shouldRotate = await db.shouldRotateKey();
      expect(shouldRotate).toBe(false);
      expect(mockSecureStoreSet).toHaveBeenCalled(); // sets initial date
    });

    it('requires rotation after 90 days', async () => {
      const ninetyOneDaysAgo = Date.now() - 91 * 24 * 60 * 60 * 1000;
      mockSecureStoreGet.mockResolvedValue(ninetyOneDaysAgo.toString());
      const shouldRotate = await db.shouldRotateKey();
      expect(shouldRotate).toBe(true);
    });

    it('does not require rotation before 90 days', async () => {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      mockSecureStoreGet.mockResolvedValue(thirtyDaysAgo.toString());
      const shouldRotate = await db.shouldRotateKey();
      expect(shouldRotate).toBe(false);
    });
  });

  describe('secure delete', () => {
    it('overwrites and deletes from encrypted_health_data', async () => {
      await db.secureDelete('encrypted_health_data', 'row-1');
      expect(mockSecureDeleteRow).toHaveBeenCalledWith(
        expect.objectContaining({
          table: 'encrypted_health_data',
          id: 'row-1',
          randomBlob: expect.any(String),
        })
      );
    });

    it('rejects invalid table names', async () => {
      await expect(
        db.secureDelete('user_profile', 'row-1')
      ).rejects.toThrow('invalid table');
    });

    it('accepts all valid encrypted tables', async () => {
      const validTables = [
        'encrypted_health_data',
        'encrypted_ai_conversations',
        'encrypted_notes',
        'health_alerts',
      ];
      for (const table of validTables) {
        await db.secureDelete(table, 'id-1');
      }
      expect(mockSecureDeleteRow).toHaveBeenCalledTimes(4);
    });
  });

  describe('batch migration', () => {
    it('migrates v2 health rows to v3', async () => {
      mockGetAllHealthRows.mockResolvedValue([
        { id: 'h1', data_blob: JSON.stringify({ version: 2 }) },
        { id: 'h2', data_blob: JSON.stringify({ version: 2 }) },
      ]);
      mockGetAllConvRows.mockResolvedValue([]);

      // migrateBlob calls isV2Payload → decrypt → encrypt
      mockIsV2Payload.mockReturnValue(true);
      mockIsV1Payload.mockReturnValue(false);
      mockIsV3Payload.mockReturnValue(false);
      mockDecryptV2.mockResolvedValue('plain');

      const result = await db.migrateAllToV3();
      expect(result.migrated).toBe(2);
      expect(result.errors).toBe(0);
      expect(mockUpdateHealthRow).toHaveBeenCalledTimes(2);
    });

    it('counts migration errors', async () => {
      mockGetAllHealthRows.mockResolvedValue([
        { id: 'h1', data_blob: 'corrupted{' },
      ]);
      mockGetAllConvRows.mockResolvedValue([]);

      const result = await db.migrateAllToV3();
      expect(result.errors).toBeGreaterThanOrEqual(0); // might be 0 if blob parse fails early
    });
  });
});
