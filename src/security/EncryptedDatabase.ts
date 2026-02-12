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
import {
  acknowledgeHealthAlertRow,
  getActiveHealthAlertRows,
  getAllEncryptedAIConversationRows,
  getAllEncryptedHealthRows,
  getEncryptedAIConversations,
  getEncryptedHealthRow,
  getEncryptedHealthRowsByCategory,
  getEncryptedNoteRow,
  insertEncryptedAIConversationRow,
  insertEncryptedHealthRow,
  insertEncryptedNoteRow,
  insertHealthAlertRow,
  secureDeleteEncryptedRow,
  updateEncryptedAIConversationRow,
  updateEncryptedHealthRow,
} from '../database/service';
import {
  type EncryptedPayload,
  decryptV2,
  decryptV3,
  encryptV3,
  isV2Payload,
  isV3Payload,
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

    this.initialized = true;
    console.log('[FitQuest Security] Encrypted database v3 initialized (AES-256-GCM)');
  }

  // ============================================
  // INTERNAL: ENCRYPT / DECRYPT with auto-migration
  // ============================================

  private async encrypt(plaintext: string): Promise<string> {
    this.ensureInitialized();
    const payload = await encryptV3(plaintext, this.masterKey!);
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

    if (isV3Payload(payload)) {
      return decryptV3(payload, this.masterKey!);
    }

    if (isV2Payload(payload)) {
      return decryptV2(payload, this.masterKey!);
    }

    throw new Error('[Security] Unsupported encrypted payload format');
  }

  private async migrateBlob(blob: string): Promise<string | null> {
    const payload = JSON.parse(blob);
    if (!isV1Payload(payload) && !isV2Payload(payload)) return null;

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

    await insertEncryptedHealthRow({
      id,
      category,
      data_blob: encryptedBlob,
      created_at: now,
      updated_at: now,
    });

    return id;
  }

  async getHealthData(id: string): Promise<object | null> {
    this.ensureInitialized();
    const row = await getEncryptedHealthRow(id);

    if (!row) return null;

    const plaintext = await this.decrypt(row.data_blob);

    const migrated = await this.migrateBlob(row.data_blob);
    if (migrated) {
      await updateEncryptedHealthRow({ id, data_blob: migrated, updated_at: Date.now() });
    }

    return JSON.parse(plaintext);
  }

  async getRecentHealthData(category: string, limit = 50): Promise<object[]> {
    this.ensureInitialized();
    const rows = await getEncryptedHealthRowsByCategory(category, limit);

    const results: object[] = [];
    for (const row of rows) {
      try {
        const plaintext = await this.decrypt(row.data_blob);
        results.push({ id: row.id, ...JSON.parse(plaintext), created_at: row.created_at });

        const migrated = await this.migrateBlob(row.data_blob);
        if (migrated) {
          await updateEncryptedHealthRow({
            id: row.id,
            data_blob: migrated,
            updated_at: Date.now(),
          });
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

    await insertEncryptedAIConversationRow({
      id,
      personality,
      query_blob: encQuery,
      response_blob: encResponse,
      context_doc_ids: metadata?.contextDocIds ? JSON.stringify(metadata.contextDocIds) : null,
      model_version: metadata?.modelVersion || null,
      tokens_used: metadata?.tokensUsed || 0,
      processing_time_ms: metadata?.processingTimeMs || 0,
      created_at: Date.now(),
    });

    return id;
  }

  async getAIConversations(personality: 'COACH' | 'PROFESSOR', limit = 20): Promise<
    Array<{ id: string; query: string; response: string; created_at: number }>
  > {
    this.ensureInitialized();
    const rows = await getEncryptedAIConversations(personality, limit);

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

    await insertHealthAlertRow({
      id,
      alert_type: alertType,
      severity,
      data_blob: encData,
      location_blob: encLocation,
      created_at: Date.now(),
    });

    return id;
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    await acknowledgeHealthAlertRow(alertId, Date.now());
  }

  async getActiveAlerts(): Promise<
    Array<{ id: string; alertType: string; severity: string; data: object; created_at: number }>
  > {
    this.ensureInitialized();
    const rows = await getActiveHealthAlertRows();

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

    await insertEncryptedNoteRow({
      id,
      reference_type: referenceType,
      reference_id: referenceId,
      content_blob: encryptedBlob,
      created_at: now,
      updated_at: now,
    });

    return id;
  }

  async getNote(id: string): Promise<string | null> {
    this.ensureInitialized();
    const row = await getEncryptedNoteRow(id);

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

  async migrateAllToV3(): Promise<{ migrated: number; errors: number }> {
    this.ensureInitialized();
    let migrated = 0;
    let errors = 0;

    const healthRows = await getAllEncryptedHealthRows();
    for (const row of healthRows) {
      try {
        const newBlob = await this.migrateBlob(row.data_blob);
        if (newBlob) {
          await updateEncryptedHealthRow({ id: row.id, data_blob: newBlob, updated_at: Date.now() });
          migrated++;
        }
      } catch {
        errors++;
      }
    }

    const convRows = await getAllEncryptedAIConversationRows();
    for (const row of convRows) {
      try {
        const newQuery = await this.migrateBlob(row.query_blob);
        const newResp = await this.migrateBlob(row.response_blob);
        if (newQuery || newResp) {
          await updateEncryptedAIConversationRow({
            id: row.id,
            query_blob: newQuery || row.query_blob,
            response_blob: newResp || row.response_blob,
          });
          migrated++;
        }
      } catch {
        errors++;
      }
    }

    console.log(`[Security] legacy→v3 migration: ${migrated} migrated, ${errors} errors`);
    return { migrated, errors };
  }

  // ============================================
  // SECURE DELETE
  // ============================================

  async secureDelete(table: string, id: string): Promise<void> {
    const randomBlob = Array.from(await Crypto.getRandomBytesAsync(128))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (
      table !== 'encrypted_health_data' &&
      table !== 'encrypted_ai_conversations' &&
      table !== 'encrypted_notes' &&
      table !== 'health_alerts'
    ) {
      throw new Error('[Security] secureDelete called with invalid table');
    }

    await secureDeleteEncryptedRow({
      table,
      id,
      randomBlob,
    });
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
