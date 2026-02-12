# Security Remediation Plan

Scope: Offline-first Expo app with SQLite and application-layer encryption.

## 1) Crypto Compliance (P0)
Status: Completed

Issue: AESEncryption uses CTR+HMAC instead of required AES-256-GCM.

Steps:
1. Implement AES-256-GCM with a vetted library for React Native (dev client or bare).
2. Keep v2 payload versioning; add v3 payload to avoid breaking data.
3. Update encryptedDB to migrate v2 (CTR+HMAC) to v3 (AES-GCM) on read.
4. Add a key-rotation policy with explicit UI and secure backup warnings.

## 2) Health Data Encryption (P0)
Status: Completed

Issue: `heart_rate_readings` stores plaintext health metrics.

Steps:
1. Move heart rate data into encrypted storage using `encryptedDB.storeHealthData()`.
2. Keep only aggregate / non-sensitive metadata in plaintext (if required).
3. Add data access helpers that decrypt per record.

## 3) Eliminate AsyncStorage (P0)
Status: Completed

Issue: Hard stop policy violation in ThemeContext, LanguageContext, Apollo auth, offline cache.

Steps:
1. Migrate Theme + Language preferences to SecureStore or `app_state`.
2. Remove AsyncStorage from Apollo client; use SecureStore or SQLite auth table.
3. Remove offline-cache module or replace with SQLite.

## 4) Schema and SQL Governance (P0)
Status: Completed

Issue: Raw SQL in FitMind schema and SubscriptionManager; schema drift.

Steps:
1. Move FitMind table creation to `src/database/schema.ts` as canonical.
2. Remove `fitmind/schema.ts` table creation or refactor into service only.
3. Remove trial_state creation from SubscriptionManager; add it to schema.ts.

## 5) SQL Injection Surface (P1)
Status: Completed

Issue: `EncryptedDatabase.secureDelete(table)` uses dynamic table name.

Steps:
1. Whitelist allowed table names.
2. Use a switch or map to SQL strings for each allowed table.

## 6) Logging & Redaction (P1)
Status: Completed

Issue: Mixed logging practices; no redaction policy.

Steps:
1. Introduce a logger wrapper with redaction for tokens/keys.
2. Enforce no sensitive data in logs.

## 7) Security Tests (P1)
Status: Completed

- Test crypto migration with known vectors.
- Test session expiry and biometric fallback.
- Validate encrypted DB read/write for health data.
- Note: rerun `npm test` after dependency install to confirm green.
