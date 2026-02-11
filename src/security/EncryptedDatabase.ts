/**
 * FitQuest Encrypted Database Layer — v2
 * 
 * Application-layer authenticated encryption for sensitive SQLite columns.
 * 
 * v2 Improvements over v1:
 * - CTR-mode cipher with PBKDF2-derived key streams (replaces XOR)
 * - HMAC-SHA256 Encrypt-then-MAC authentication (tamper detection)
 * - Per-message random IV + salt (no key reuse)
 * - Automatic v1→v2 transparent migration on read
 * - Constant-time tag comparison (timing attack resistant)
 * 
 * Encrypted data types: health metrics, personal notes, AI conversations,
 * heart rate readings, emergency locations.
 * 
 * Non-sensitive data (exercises, workouts, themes) stays plaintext for performance.
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { getDatabase } from '../database/schema';
import {
  type EncryptedPayload,
  encryptV2,
  decryptV2,
  isV1Payload,
  decryptV1Legacy,
  getOrCreateMasterKey,
} from './AESEncryption';

// Legacy key alias (v1) — needed for migration
const LEGACY_KEY_ALIAS = 'fitquest_encryption_key';

// ============================================
// TYPES
// ============================================

export interface EncryptedRow {
  id: string;
  data_blob: string;
  created_at: number;
  updated_at: number;
}

// ============================================
// UUID GENERATION
// ============================================

async function generateSecureUUID(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    '4' + hex.slice(13, 16),
    ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-');
}

// ============================================
// ENCRYPTED DATABASE SERVICE
// ============================================

export class EncryptedDatabaseService {
  private masterKey: string | null = null;
  private legacyKey: string | null = null;
  private initialized = false;

  /**
   * Initialize encryption keys and create encrypted tables.
   * Call once at app start (after DatabaseContext init).
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Get v2 master key (creates if needed)
    this.masterKey = await getOrCreateMasterKey();

    // Load legacy v1 key for migration (if exists)
    this.legacyKey = await SecureStore.getItemAsync(LEGACY_KEY_ALIAS);

    const db = await getDatabase();

    // Create tables for encrypted data
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS encrypted_health_data (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        data_blob TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS encrypted_ai_conversations (
        id TEXT PRIMARY KEY,
        ai_personality TEXT NOT NULL CHECK(ai_personality IN ('COACH', 'PROFESSOR')),
        query_blob TEXT NOT NULL,
        response_blob TEXT NOT NULL,
        context_doc_ids TEXT,
        model_version TEXT,
        tokens_used INTEGER DEFAULT 0,
        processing_time_ms INTEGER DEFAULT 0,
        feedback_rating INTEGER,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS encrypted_notes (
        id TEXT PRIMARY KEY,
        reference_type TEXT NOT NULL,
        reference_id TEXT,
        content_blob TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS health_alerts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'user_local_001',
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
        data_blob TEXT NOT NULL,
        location_blob TEXT,
        acknowledged_at INTEGER,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_enc_health_category ON encrypted_health_data(category, created_at);
      CREATE INDEX IF NOT EXISTS idx_enc_ai_personality ON encrypted_ai_conversations(ai_personality, created_at);
      CREATE INDEX IF NOT EXISTS idx_health_alerts_type ON health_alerts(alert_type, created_at);
    `);

    this.initialized = true;
    console.log('[FitQuest Security] Encrypted database v2 initialized (HMAC-authenticated CTR mode)');
  }

  // ============================================
  // INTERNAL: ENCRYPT / DECRYPT with auto-migration
  // ============================================

  private async encrypt(plaintext: string): Promise<string> {
    this.ensureInitialized();
    const payload = await encryptV2(plaintext, this.masterKey!);
    return JSON.stringify(payload);
  }

  private async decrypt(blob: string): Promise<string> {
    this.ensureInitialized();
    const payload = JSON.parse(blob);

    if (isV1Payload(payload)) {
      if (!this.legacyKey) {
        throw new Error('[Security] Legacy v1 data found but no v1 key available for migration');
      }
      return decryptV1Legacy(payload, this.legacyKey);
    }

    return decryptV2(payload, this.masterKey!);
  }

  private async migrateBlob(blob: string): Promise<string | null> {
    const payload = JSON.parse(blob);
    if (!isV1Payload(payload)) return null;

    try {
      const plaintext = await this.decrypt(blob);
      return this.encrypt(plaintext);
    } catch (e) {
      console.warn('[Security] v1→v2 migration failed for blob:', e);
      return null;
    }
  }

  // ============================================
  // ENCRYPTED HEALTH DATA
  // ============================================

  async storeHealthData(category: string, data: object): Promise<string> {
    this.ensureInitialized();
    const id = await generateSecureUUID();
    const encryptedBlob = await this.encrypt(JSON.stringify(data));
    const now = Date.now();

    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO encrypted_health_data (id, category, data_blob, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, category, encryptedBlob, now, now]
    );

    return id;
  }

  async getHealthData(id: string): Promise<object | null> {
    this.ensureInitialized();
    const db = await getDatabase();
    const row = await db.getFirstAsync<EncryptedRow>(
      `SELECT * FROM encrypted_health_data WHERE id = ?`,
      [id]
    );

    if (!row) return null;

    const plaintext = await this.decrypt(row.data_blob);

    const migrated = await this.migrateBlob(row.data_blob);
    if (migrated) {
      await db.runAsync(
        `UPDATE encrypted_health_data SET data_blob = ?, updated_at = ? WHERE id = ?`,
        [migrated, Date.now(), id]
      );
    }

    return JSON.parse(plaintext);
  }

  async getRecentHealthData(category: string, limit = 50): Promise<object[]> {
    this.ensureInitialized();
    const db = await getDatabase();
    const rows = await db.getAllAsync<EncryptedRow>(
      `SELECT * FROM encrypted_health_data WHERE category = ? ORDER BY created_at DESC LIMIT ?`,
      [category, limit]
    );

    const results: object[] = [];
    for (const row of rows) {
      try {
        const plaintext = await this.decrypt(row.data_blob);
        results.push({ id: row.id, ...JSON.parse(plaintext), created_at: row.created_at });

        const migrated = await this.migrateBlob(row.data_blob);
        if (migrated) {
          await db.runAsync(
            `UPDATE encrypted_health_data SET data_blob = ?, updated_at = ? WHERE id = ?`,
            [migrated, Date.now(), row.id]
          );
        }
      } catch (e) {
        console.warn(`[Security] Failed to decrypt health data ${row.id}:`, e);
      }
    }

    return results;
  }

  // ============================================
  // ENCRYPTED AI CONVERSATIONS
  // ============================================

  async storeAIConversation(
    personality: 'COACH' | 'PROFESSOR',
    query: string,
    response: string,
    metadata?: {
      contextDocIds?: string[];
      modelVersion?: string;
      tokensUsed?: number;
      processingTimeMs?: number;
    }
  ): Promise<string> {
    this.ensureInitialized();
    const id = await generateSecureUUID();

    const encQuery = await this.encrypt(query);
    const encResponse = await this.encrypt(response);

    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO encrypted_ai_conversations 
       (id, ai_personality, query_blob, response_blob, context_doc_ids, model_version, tokens_used, processing_time_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        personality,
        encQuery,
        encResponse,
        metadata?.contextDocIds ? JSON.stringify(metadata.contextDocIds) : null,
        metadata?.modelVersion || null,
        metadata?.tokensUsed || 0,
        metadata?.processingTimeMs || 0,
        Date.now(),
      ]
    );

    return id;
  }

  async getAIConversations(personality: 'COACH' | 'PROFESSOR', limit = 20): Promise<
    Array<{ id: string; query: string; response: string; created_at: number }>
  > {
    this.ensureInitialized();
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      query_blob: string;
      response_blob: string;
      created_at: number;
    }>(
      `SELECT id, query_blob, response_blob, created_at 
       FROM encrypted_ai_conversations 
       WHERE ai_personality = ? 
       ORDER BY created_at DESC LIMIT ?`,
      [personality, limit]
    );

    const results: Array<{ id: string; query: string; response: string; created_at: number }> = [];
    for (const row of rows) {
      try {
        const query = await this.decrypt(row.query_blob);
        const response = await this.decrypt(row.response_blob);
        results.push({ id: row.id, query, response, created_at: row.created_at });
      } catch (e) {
        console.warn(`[Security] Failed to decrypt conversation ${row.id}:`, e);
      }
    }

    return results;
  }

  // ============================================
  // HEALTH ALERTS
  // ============================================

  async createHealthAlert(
    alertType: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    data: object,
    location?: { latitude: number; longitude: number; accuracy: number }
  ): Promise<string> {
    this.ensureInitialized();
    const id = await generateSecureUUID();
    const encData = await this.encrypt(JSON.stringify(data));

    let encLocation: string | null = null;
    if (location) {
      encLocation = await this.encrypt(JSON.stringify(location));
    }

    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO health_alerts (id, alert_type, severity, data_blob, location_blob, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, alertType, severity, encData, encLocation, Date.now()]
    );

    return id;
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE health_alerts SET acknowledged_at = ? WHERE id = ?`,
      [Date.now(), alertId]
    );
  }

  async getActiveAlerts(): Promise<
    Array<{ id: string; alertType: string; severity: string; data: object; created_at: number }>
  > {
    this.ensureInitialized();
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      alert_type: string;
      severity: string;
      data_blob: string;
      created_at: number;
    }>(
      `SELECT id, alert_type, severity, data_blob, created_at 
       FROM health_alerts 
       WHERE acknowledged_at IS NULL 
       ORDER BY created_at DESC`
    );

    const results = [];
    for (const row of rows) {
      try {
        const data = await this.decrypt(row.data_blob);
        results.push({
          id: row.id,
          alertType: row.alert_type,
          severity: row.severity,
          data: JSON.parse(data),
          created_at: row.created_at,
        });
      } catch (e) {
        console.warn(`[Security] Failed to decrypt alert ${row.id}:`, e);
      }
    }

    return results;
  }

  // ============================================
  // ENCRYPTED NOTES
  // ============================================

  async storeNote(referenceType: string, referenceId: string, content: string): Promise<string> {
    this.ensureInitialized();
    const id = await generateSecureUUID();
    const encryptedBlob = await this.encrypt(content);
    const now = Date.now();

    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO encrypted_notes (id, reference_type, reference_id, content_blob, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, referenceType, referenceId, encryptedBlob, now, now]
    );

    return id;
  }

  async getNote(id: string): Promise<string | null> {
    this.ensureInitialized();
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ content_blob: string }>(
      `SELECT content_blob FROM encrypted_notes WHERE id = ?`,
      [id]
    );

    if (!row) return null;
    return this.decrypt(row.content_blob);
  }

  // ============================================
  // KEY ROTATION & MIGRATION
  // ============================================

  async shouldRotateKey(): Promise<boolean> {
    const lastRotation = await SecureStore.getItemAsync('fitquest_key_rotation_date');
    if (!lastRotation) {
      await SecureStore.setItemAsync('fitquest_key_rotation_date', Date.now().toString());
      return false;
    }

    const daysSinceRotation = (Date.now() - parseInt(lastRotation)) / (1000 * 60 * 60 * 24);
    return daysSinceRotation > 90;
  }

  async migrateAllToV2(): Promise<{ migrated: number; errors: number }> {
    this.ensureInitialized();
    const db = await getDatabase();
    let migrated = 0;
    let errors = 0;

    const healthRows = await db.getAllAsync<{ id: string; data_blob: string }>(
      `SELECT id, data_blob FROM encrypted_health_data`
    );
    for (const row of healthRows) {
      try {
        const newBlob = await this.migrateBlob(row.data_blob);
        if (newBlob) {
          await db.runAsync(
            `UPDATE encrypted_health_data SET data_blob = ?, updated_at = ? WHERE id = ?`,
            [newBlob, Date.now(), row.id]
          );
          migrated++;
        }
      } catch {
        errors++;
      }
    }

    const convRows = await db.getAllAsync<{ id: string; query_blob: string; response_blob: string }>(
      `SELECT id, query_blob, response_blob FROM encrypted_ai_conversations`
    );
    for (const row of convRows) {
      try {
        const newQuery = await this.migrateBlob(row.query_blob);
        const newResp = await this.migrateBlob(row.response_blob);
        if (newQuery || newResp) {
          await db.runAsync(
            `UPDATE encrypted_ai_conversations SET query_blob = ?, response_blob = ? WHERE id = ?`,
            [newQuery || row.query_blob, newResp || row.response_blob, row.id]
          );
          migrated++;
        }
      } catch {
        errors++;
      }
    }

    console.log(`[Security] v1→v2 migration: ${migrated} migrated, ${errors} errors`);
    return { migrated, errors };
  }

  // ============================================
  // SECURE DELETE
  // ============================================

  async secureDelete(table: string, id: string): Promise<void> {
    const db = await getDatabase();

    const randomBlob = Array.from(await Crypto.getRandomBytesAsync(128))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    await db.runAsync(`UPDATE ${table} SET data_blob = ? WHERE id = ?`, [randomBlob, id]);
    await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
  }

  // ============================================
  // HELPERS
  // ============================================

  private ensureInitialized(): void {
    if (!this.initialized || !this.masterKey) {
      throw new Error('[Security] EncryptedDatabase not initialized. Call initialize() first.');
    }
  }
}

// Singleton instance
export const encryptedDB = new EncryptedDatabaseService();
