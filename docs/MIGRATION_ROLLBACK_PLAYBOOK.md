# Migration Rollback Playbook

## Overview

This document outlines procedures for safely rolling back database migrations and critical changes in FitQuest mobile. All migrations are forward-only by design, but recovery procedures exist for data protection.

---

## Schema Migration Strategy

### Current Architecture
- Schema version tracked in `app_state` table (`schema_version` key)
- Migrations applied sequentially in `src/database/schema.ts`
- Each version bump adds tables/columns but never removes existing structures
- Current version: **9** (defined in `src/database/types.ts`)

### Migration Safety Rules
1. **Never drop columns** in production migrations
2. **Never modify column types** — add new columns instead
3. **Always provide defaults** for new columns
4. **Test migrations** on fresh install AND existing data

---

## Rollback Scenarios

### Scenario 1: Failed Migration on App Update

**Symptoms:**
- App crashes on launch after update
- Database error in crash logs mentioning schema

**Immediate Actions:**
1. User can reinstall previous app version (if available)
2. For dev builds: clear app data and reinstall

**Recovery Procedure:**
```sql
-- Check current schema version
SELECT value FROM app_state WHERE key = 'schema_version';

-- If migration partially applied, manual cleanup may be needed
-- Contact development team with exact error message
```

### Scenario 2: Corrupted Encrypted Data

**Symptoms:**
- Health data shows as missing/zero
- "Decryption failed" errors in logs

**Recovery Procedure:**
1. Check `encrypted_health_data` table integrity:
```sql
SELECT COUNT(*) FROM encrypted_health_data;
SELECT id, category, created_at FROM encrypted_health_data LIMIT 10;
```

2. If data exists but won't decrypt:
   - Master key may be corrupted in SecureStore
   - User must re-authenticate with biometrics to regenerate key
   - Historical encrypted data will be unrecoverable

3. Force key rotation (developer action):
```typescript
import { encryptedDB } from './src/security/EncryptedDatabase';
await encryptedDB.forceKeyRotation(); // Creates new key, old data lost
```

### Scenario 3: FitMind Document Corruption

**Symptoms:**
- Documents show but won't open
- "Content hash mismatch" errors

**Recovery Procedure:**
1. Check document integrity:
```sql
SELECT id, title, status, file_size FROM fitmind_documents WHERE status != 'ARCHIVED';
```

2. Re-import affected documents:
```typescript
import { importPipeline } from './src/fitmind/DocumentImportPipeline';
await importPipeline.reimport(documentId, { force: true });
```

3. If file missing from storage:
   - User must re-add document from original source
   - Annotations/flashcards linked to document are preserved

### Scenario 4: Exercise Seed Data Issues

**Symptoms:**
- No exercises available
- Workout generation returns empty array

**Recovery Procedure:**
1. Check exercise count:
```sql
SELECT COUNT(*) FROM exercises;
```

2. If zero, trigger re-seed:
```typescript
import { seedExercises } from './src/database/seed';
await seedExercises();
```

3. Verify related tables:
```sql
SELECT COUNT(*) FROM exercise_muscles;
SELECT COUNT(*) FROM exercise_equipment;
SELECT COUNT(*) FROM exercise_training_types;
```

---

## Data Export Before Migration

For users needing data preservation before risky updates:

```typescript
import { exportUserData } from './src/services/dataExportService';

// Creates JSON backup of all user data
const exportPath = await exportUserData({
  includeProfile: true,
  includeWorkouts: true,
  includeProgress: true,
  includeSettings: true,
  // Encrypted data requires biometric auth to include
  includeHealthData: true,
});

// File saved to: ${FileSystem.documentDirectory}exports/
```

---

## Emergency Recovery Steps

### Complete Database Reset
**WARNING: Destroys all user data**

```typescript
import { resetDatabase } from './src/database/schema';
import { initializeDatabase } from './src/database/index';

await resetDatabase(); // Drops all tables
await initializeDatabase(); // Recreates fresh schema + seeds
```

### Partial Table Recovery

For specific table issues without full reset:

```typescript
import { getDatabase } from './src/database/schema';

const db = await getDatabase();

// Example: Reset workout streaks only
await db.runAsync('DELETE FROM workout_streaks WHERE user_id = ?', [userId]);
// Streak will rebuild from workout_sessions on next calculation
```

---

## Version-Specific Notes

### v7 → v8 Migration
- Added `heart_rate_readings`, `anomaly_log`, `daily_health_summaries` tables
- Added `document_content_hashes` for deduplication
- Safe: all new tables, no modifications to existing

### v8 → v9 Migration  
- Added `trial_state` table for subscription trials
- Safe: new table only

---

## Contact Points

For migration issues requiring development intervention:
1. Collect crash logs from ErrorTelemetry
2. Export database state if possible
3. Document exact app version and previous version
4. Note device/OS details

---

## Prevention Best Practices

1. **Always run `npm run typecheck` before commits**
2. **Test on fresh install AND upgrade path**
3. **Increment schema version for any table changes**
4. **Use service layer for all database operations**
5. **Never bypass encrypted storage for sensitive data**
