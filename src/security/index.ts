/**
 * FitQuest Security Module
 *
 * Re-exports all security services for convenient imports:
 *
 * import { encryptedDB, BiometricAuthService, migrateToSecureStorage } from '../security';
 */

export { EncryptedDatabaseService, encryptedDB } from './EncryptedDatabase';
export type { EncryptedRow } from './EncryptedDatabase';

export { encryptV2, decryptV2, isV1Payload, decryptV1Legacy, getOrCreateMasterKey } from './AESEncryption';
export type { EncryptedPayload } from './AESEncryption';

export { BiometricAuthService } from './BiometricAuth';
export type { BiometricType, BiometricCapability, AuthResult, SessionInfo } from './BiometricAuth';

export {
  migrateToSecureStorage,
  getAuthToken,
  getUserProfile,
  setAuthCredentials,
  clearAuthCredentials,
  isMigrationComplete,
} from './StorageMigration';
export type { MigrationResult } from './StorageMigration';
