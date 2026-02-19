# FitQuest 2.0 Mobile — Copilot Instructions

## ⛔ HARD STOPS — NEVER VIOLATE THESE RULES

### Architecture Violations (Auto-Reject)
- **NEVER** create new state management patterns — use existing Context providers or Zustand store
- **NEVER** add new Apollo queries — Apollo is legacy, SQLite is the only data source
- **NEVER** store sensitive data in plain SQLite — use `encryptedDB` methods from `src/security/EncryptedDatabase.ts`
- **NEVER** use AsyncStorage — all storage must go through SecureStore or SQLite
- **NEVER** hardcode colors or spacing — always use `theme.colors.*` and `theme.spacing[n]`
- **NEVER** use `theme.spacing.md` — spacing uses NUMERIC keys like `theme.spacing[4]`
- **NEVER** create XOR encryption code — use AES-256-GCM from `src/security/AESEncryption.ts`
- **NEVER** instantiate `RealisticHealthEngine` — it exports static methods only

### Schema Violations (Auto-Reject)
- **NEVER** reference `last_read_at` column — it doesn't exist, use `updated_at` instead
- **NEVER** add columns to core tables without incrementing `SCHEMA_VERSION` in `src/database/types.ts`
- **NEVER** modify encrypted tables (`encrypted_health_data`, `encrypted_ai_conversations`, etc.) — use EncryptedDatabase service
- **NEVER** query `exercises` table without checking seed status first (may be empty on fresh install)
- **NEVER** write raw SQL outside of `src/database/schema.ts` or `src/database/service.ts`

### Component Violations (Auto-Reject)
- **NEVER** use `bg-white`, `bg-gray-50`, or light backgrounds — dark theme requires `bg-slate-900` or `bg-zinc-900`
- **NEVER** wrap file paths in backticks — use proper markdown links: `[src/design/theme-system.ts](../src/design/theme-system.ts)`
- **NEVER** create new Button components — use `GradientButton` from `src/components/ui/GlassUI.tsx`
- **NEVER** use inline styles for theme values — extract to theme system first
- **NEVER** import `ThemedText` as a named import — it's a DEFAULT export

### Security Violations (Auto-Reject)
- **NEVER** log encryption keys, tokens, or biometric data to console
- **NEVER** bypass `BiometricAuth` session validation — always check `isSessionValid()`
- **NEVER** store health metrics (heart rate, sleep, weight) without encryption
- **NEVER** use `Math.random()` for security — use `expo-random` for cryptographic randomness

---

## 🐛 KNOWN BUG PATTERNS — DO NOT REPEAT

### Database Column Errors
❌ **Bug**: Querying `last_read_at` from `fitmind_documents` → column doesn't exist  
✅ **Fix**: Use `updated_at` instead (column exists in schema v7+)

❌ **Bug**: Reading `audio_transition` from seeded exercises before schema v6  
✅ **Fix**: Always seed exercises AFTER table creation, never before

❌ **Bug**: Inserting into `encrypted_health_data` without `updated_at` timestamp  
✅ **Fix**: Both `created_at` and `updated_at` are required (INTEGER, Unix epoch)

### State Management Errors
❌ **Bug**: Creating new Context for workout state → duplicates existing hooks  
✅ **Fix**: Use `useFitQuestWorkout` hook from `src/hooks/useFitQuestWorkout.ts`

❌ **Bug**: Storing XP in local component state → doesn't persist across sessions  
✅ **Fix**: XP lives in `app_state` table via `src/services/xpService.ts`

❌ **Bug**: Fetching user profile with Apollo → profile is offline-only  
✅ **Fix**: Use `DatabaseService.getUserProfile()` from `src/database/service.ts`

### Theme System Errors
❌ **Bug**: Using `theme.spacing.md` → throws "undefined" error  
✅ **Fix**: Spacing uses numeric keys: `theme.spacing[4]` (16px)

❌ **Bug**: Hardcoding `#FFFFFF` for modal background → breaks dark theme  
✅ **Fix**: Use `theme.colors.surface` or `theme.colors.background`

❌ **Bug**: Showing white text on light background in light mode  
✅ **Fix**: Use `ThemedText` with `color="primary"` prop (auto-adapts)

### Encryption Errors
❌ **Bug**: Storing AI conversations in plain `app_state` table  
✅ **Fix**: Use `encryptedDB.storeAIConversation()` → stores in `encrypted_ai_conversations`

❌ **Bug**: Using v1 XOR encryption for new data  
✅ **Fix**: All new data uses v2 AES-256-GCM (`encryptV2()` from AESEncryption.ts)

❌ **Bug**: Reading encrypted health data without migration check  
✅ **Fix**: `encryptedDB` auto-migrates v1→v2 on read, but always use the service

### Sensor/Health Errors
❌ **Bug**: Manually calculating steps from accelerometer  
✅ **Fix**: Use `sensorFusion` singleton from `src/engines/SensorFusionEngine.ts`

❌ **Bug**: Showing recovery status without checking fatigue map  
✅ **Fix**: Call `recoveryEngine.getRecoveryStatus()` before rendering workout suggestions

❌ **Bug**: Creating health alerts without anomaly detection  
✅ **Fix**: Use `anomalyDetector.checkForAnomalies()` → auto-creates encrypted alerts

### FitMind Module Errors
❌ **Bug**: Querying `fitmind_documents` before FitMind init  
✅ **Fix**: Ensure `initializeDatabase()` has run before any FitMind reads/writes

❌ **Bug**: Storing document content in `file_path` column  
✅ **Fix**: Large content goes in `content` TEXT column, file path is just a reference

❌ **Bug**: Flashcard `next_review` as ISO string → expects INTEGER Unix timestamp  
✅ **Fix**: Use `Date.now()` or `Math.floor(Date.now() / 1000)` for consistency

### Exercise Data Errors
❌ **Bug**: `JSON.parse(row.instructions)` crashes on plain-text instructions from external exercises  
✅ **Fix**: Use `safeParseInstructions()` in `service.ts` — handles JSON arrays, plain text, and null

❌ **Bug**: Using old category names (`calisthenics`, `building_muscle`, `getting_taller`, etc.)  
✅ **Fix**: v14 renamed categories. Use: `body_control`, `posture`, `speed`, `mobility`, `focus`, `strength`

❌ **Bug**: Creating variation exercises (Tempo/Pause/Isometric/Plyometric/etc.) bloats DB  
✅ **Fix**: v12 migration stripped 364 variations. Generator only creates base exercises now

❌ **Bug**: `useCallback` placed after an early `return` → "Rendered more hooks" crash  
✅ **Fix**: All hooks MUST be before any conditional return in React components

---

## 📊 EMBEDDED SCHEMA — SCHEMA VERSION 15

Below is the **canonical SQL schema** (auto-generated from `src/database/schema.ts`). When generating queries, ONLY reference columns that exist below:

### Core Fitness Tables

```sql
-- EXERCISES CATALOGUE
CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('body_control', 'posture', 'speed', 'mobility', 'focus', 'strength')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  equipment_level TEXT NOT NULL CHECK (equipment_level IN ('none', 'minimal', 'playground')),
  impact_level TEXT NOT NULL CHECK (impact_level IN ('no_impact', 'low_impact', 'high_impact')),
  space_required TEXT NOT NULL CHECK (space_required IN ('mat_only_1x1', 'small_bedroom_2x2', 'living_room_3x3', 'outdoors_hall')),
  time_per_set_seconds INTEGER NOT NULL DEFAULT 30,
  instructions TEXT NOT NULL, -- JSON array
  order_in_category INTEGER NOT NULL DEFAULT 0,
  audio_intro TEXT NOT NULL DEFAULT '',
  audio_setup TEXT NOT NULL DEFAULT '',
  audio_execution TEXT NOT NULL DEFAULT '',
  audio_transition TEXT NOT NULL DEFAULT '',
  force_type TEXT,
  mechanic TEXT,
  external_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE exercise_muscles (
  exercise_id TEXT NOT NULL,
  muscle TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (exercise_id, muscle),
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

CREATE TABLE exercise_equipment (
  exercise_id TEXT NOT NULL,
  equipment TEXT NOT NULL,
  is_required INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (exercise_id, equipment),
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

CREATE TABLE exercise_training_types (
  exercise_id TEXT NOT NULL,
  training_type TEXT NOT NULL CHECK (training_type IN ('strength', 'hypertrophy', 'endurance', 'mobility', 'speed_power', 'balance', 'recovery', 'mindfulness', 'fat_loss', 'posture', 'decompression', 'coordination')),
  effectiveness INTEGER NOT NULL DEFAULT 5 CHECK (effectiveness BETWEEN 1 AND 10),
  PRIMARY KEY (exercise_id, training_type),
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

CREATE TABLE exercise_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id TEXT NOT NULL,
  image_path TEXT NOT NULL,
  image_order INTEGER NOT NULL DEFAULT 0,
  source TEXT DEFAULT 'external', -- 'external', 'user', 'generated', 'shared'
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

-- USER PROFILE & STATE
CREATE TABLE user_profile (
  id TEXT PRIMARY KEY,
  sex TEXT CHECK (sex IN ('male', 'female', 'other')),
  weight_kg REAL,
  height_cm REAL,
  goal TEXT NOT NULL CHECK (goal IN ('body_control', 'posture', 'speed', 'mobility', 'focus', 'strength')),
  experience TEXT NOT NULL CHECK (experience IN ('beginner', 'intermediate', 'advanced')),
  training_days_per_week INTEGER NOT NULL DEFAULT 3 CHECK (training_days_per_week BETWEEN 1 AND 7),
  time_per_session_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  locked INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE user_equipment (
  user_id TEXT NOT NULL,
  equipment TEXT NOT NULL,
  PRIMARY KEY (user_id, equipment),
  FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
);

CREATE TABLE user_injuries (
  user_id TEXT NOT NULL,
  muscle TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('mild', 'moderate', 'severe')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, muscle),
  FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
);

CREATE TABLE muscle_fatigue (
  user_id TEXT NOT NULL,
  muscle TEXT NOT NULL,
  fatigue_level INTEGER NOT NULL DEFAULT 0 CHECK (fatigue_level BETWEEN 0 AND 100),
  last_trained_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, muscle),
  FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
);

-- WORKOUT SESSIONS
CREATE TABLE workout_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  total_exercises INTEGER NOT NULL DEFAULT 0,
  completed_exercises INTEGER NOT NULL DEFAULT 0,
  success INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
);

CREATE TABLE session_exercises (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  order_in_session INTEGER NOT NULL,
  prescribed_sets INTEGER NOT NULL DEFAULT 3,
  prescribed_reps TEXT NOT NULL DEFAULT '8-12',
  completed_sets INTEGER NOT NULL DEFAULT 0,
  completed_reps TEXT,
  skipped INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);

CREATE TABLE progress_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  date TEXT NOT NULL,
  sets_completed INTEGER NOT NULL,
  reps_achieved TEXT NOT NULL,
  difficulty_rating INTEGER CHECK (difficulty_rating BETWEEN 1 AND 10),
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);

-- SUBSCRIPTION & APP STATE
CREATE TABLE subscription_state (
  user_id TEXT PRIMARY KEY,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'premium')),
  expires_at TEXT,
  last_verified_at TEXT NOT NULL DEFAULT (datetime('now')),
  grace_period_start TEXT,
  receipt_data TEXT,
  FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
);

CREATE TABLE trial_state (
  user_id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  converted INTEGER DEFAULT 0,
  product_identifier TEXT,
  notifications_sent TEXT DEFAULT '[]'
);

CREATE TABLE app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- STREAKS & ANALYTICS
CREATE TABLE workout_streaks (
  user_id TEXT PRIMARY KEY,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_workout_date TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
);

-- MOVE MODULE
CREATE TABLE daily_steps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  steps INTEGER NOT NULL DEFAULT 0,
  active_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE,
  UNIQUE(user_id, date)
);

CREATE TABLE jog_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  distance_meters REAL NOT NULL DEFAULT 0,
  avg_pace_per_km REAL,
  calories_estimate INTEGER,
  route_data TEXT, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
);

CREATE TABLE audio_settings (
  user_id TEXT PRIMARY KEY,
  voice_enabled INTEGER NOT NULL DEFAULT 1,
  speech_rate REAL NOT NULL DEFAULT 1.0 CHECK (speech_rate IN (0.8, 1.0, 1.2)),
  countdown_cues_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
);

CREATE TABLE body_craft_algorithms (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  body_type TEXT NOT NULL,
  goal_type TEXT NOT NULL,
  timeline_months INTEGER NOT NULL,
  muscle_priorities TEXT NOT NULL,
  recommended_training_split TEXT NOT NULL,
  training_days_per_week INTEGER NOT NULL,
  calories_target INTEGER NOT NULL,
  protein_g INTEGER NOT NULL,
  carbs_g INTEGER NOT NULL,
  fats_g INTEGER NOT NULL,
  daily_water_liters REAL NOT NULL,
  sleep_hours REAL NOT NULL,
  cardio_minutes_per_week INTEGER NOT NULL,
  exercise_category_weights TEXT NOT NULL,
  weekly_schedule TEXT NOT NULL,
  nutrition_tips TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
);
```

### Encrypted Data Tables (v7)

```sql
CREATE TABLE encrypted_health_data (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  data_blob TEXT NOT NULL, -- AES-256-GCM encrypted JSON
  created_at INTEGER NOT NULL, -- Unix epoch
  updated_at INTEGER NOT NULL  -- Unix epoch
);

CREATE TABLE encrypted_ai_conversations (
  id TEXT PRIMARY KEY,
  ai_personality TEXT NOT NULL CHECK(ai_personality IN ('COACH', 'PROFESSOR')),
  query_blob TEXT NOT NULL, -- encrypted
  response_blob TEXT NOT NULL, -- encrypted
  context_doc_ids TEXT,
  model_version TEXT,
  tokens_used INTEGER DEFAULT 0,
  processing_time_ms INTEGER DEFAULT 0,
  feedback_rating INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE encrypted_notes (
  id TEXT PRIMARY KEY,
  reference_type TEXT NOT NULL,
  reference_id TEXT,
  content_blob TEXT NOT NULL, -- encrypted
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE health_alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'user_local_001',
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  data_blob TEXT NOT NULL, -- encrypted
  location_blob TEXT, -- encrypted
  acknowledged_at INTEGER,
  created_at INTEGER NOT NULL
);
```

### FitMind Tables (v7)

```sql
CREATE TABLE fitmind_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT 'Unknown',
  type TEXT NOT NULL CHECK(type IN ('PDF', 'EPUB', 'ARTICLE', 'NOTE')),
  status TEXT NOT NULL DEFAULT 'UNREAD' CHECK(status IN ('UNREAD', 'READING', 'COMPLETED', 'ARCHIVED')),
  category TEXT NOT NULL DEFAULT 'General',
  tags TEXT DEFAULT '[]',
  file_path TEXT,
  file_size INTEGER DEFAULT 0,
  total_pages INTEGER DEFAULT 1,
  current_page INTEGER DEFAULT 0,
  content TEXT,
  word_count INTEGER DEFAULT 0,
  reading_level TEXT,
  estimated_minutes INTEGER DEFAULT 0,
  cover_color TEXT DEFAULT '#10B981',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL -- ⚠️ USE THIS, NOT last_read_at
);

CREATE TABLE fitmind_reading_sessions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  start_page INTEGER NOT NULL,
  end_page INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  words_read INTEGER DEFAULT 0,
  comprehension_score REAL,
  notes TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (document_id) REFERENCES fitmind_documents(id) ON DELETE CASCADE
);

CREATE TABLE fitmind_annotations (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('HIGHLIGHT', 'NOTE', 'BOOKMARK', 'QUESTION')),
  content TEXT NOT NULL,
  color TEXT DEFAULT '#10B981',
  position_start INTEGER,
  position_end INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (document_id) REFERENCES fitmind_documents(id) ON DELETE CASCADE
);

CREATE TABLE fitmind_flashcards (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  difficulty REAL DEFAULT 2.5,
  repetitions INTEGER DEFAULT 0,
  interval_days INTEGER DEFAULT 1,
  next_review INTEGER NOT NULL, -- Unix epoch timestamp
  ease_factor REAL DEFAULT 2.5,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (document_id) REFERENCES fitmind_documents(id) ON DELETE CASCADE
);

CREATE TABLE fitmind_reading_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'user_local_001',
  type TEXT NOT NULL CHECK(type IN ('DAILY_MINUTES', 'WEEKLY_PAGES', 'MONTHLY_BOOKS')),
  target INTEGER NOT NULL,
  current INTEGER DEFAULT 0,
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  achieved INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE fitmind_reading_streaks (
  user_id TEXT PRIMARY KEY DEFAULT 'user_local_001',
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_read_date TEXT,
  total_books_completed INTEGER DEFAULT 0,
  total_minutes_read INTEGER DEFAULT 0,
  total_pages_read INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL
);
```

### Advanced Health Monitoring (v8)

```sql
CREATE TABLE heart_rate_readings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'user_local_001',
  bpm INTEGER NOT NULL CHECK(bpm BETWEEN 20 AND 250),
  reading_type TEXT NOT NULL DEFAULT 'RESTING' CHECK(reading_type IN ('RESTING', 'ACTIVE', 'RECOVERY', 'MANUAL')),
  source TEXT NOT NULL DEFAULT 'MANUAL' CHECK(source IN ('MANUAL', 'SENSOR', 'WEARABLE')),
  context TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE anomaly_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'user_local_001',
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  expected_min REAL,
  expected_max REAL,
  z_score REAL,
  alert_id TEXT,
  acknowledged INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE daily_health_summaries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'user_local_001',
  date TEXT NOT NULL,
  health_score INTEGER NOT NULL CHECK(health_score BETWEEN 0 AND 100),
  total_steps INTEGER DEFAULT 0,
  active_minutes INTEGER DEFAULT 0,
  total_calories INTEGER DEFAULT 0,
  workouts_completed INTEGER DEFAULT 0,
  avg_heart_rate INTEGER,
  recovery_score INTEGER,
  sleep_quality INTEGER,
  sleep_hours REAL,
  anomaly_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, date)
);

CREATE TABLE document_content_hashes (
  hash TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (document_id) REFERENCES fitmind_documents(id) ON DELETE CASCADE
);
```

**Column Note**: All `created_at`/`updated_at` in encrypted & FitMind tables are **INTEGER Unix epoch** (milliseconds). Core fitness tables use **TEXT ISO 8601** (`datetime('now')`).

---

## Architecture

Fully client-side React Native app (Expo SDK 54, Expo Router v6, New Architecture). No backend — all data lives on-device via SQLite with application-layer encryption for sensitive data. Provider hierarchy in `app/_layout.tsx`:

```
ThemeProvider → LanguageProvider → DatabaseProvider → ApolloProvider → ThemedTabs
```

**Data layer**: SQLite (`expo-sqlite`) is the single source of truth. Schema version 9 (auto-migrating). All new data work MUST use `src/database/service.ts` for core fitness data, `src/security/EncryptedDatabase.ts` for sensitive health/AI data, and `src/fitmind/schema.ts` for cognitive fitness data. Apollo Client is a legacy facade — do NOT add new Apollo queries.

**Design reference**: The `Figma UI/` workspace folder contains the target UI design (Figma-to-code export). When building or refining screens, reference `Figma UI/src/App.tsx` for layout patterns, spacing, and visual hierarchy — then adapt to React Native using the theme system below.

## Key Directories

| Path | Purpose |
|------|---------|
| `app/` | Expo Router file-based screens (tabs: dashboard, fitquest, move, exercises, profile + hidden screens) |
| `src/components/` | Shared themed components (Button, Card, ThemedText, DropdownMenu, etc.) |
| `src/components/ui/` | Premium glass-morphism UI (GlassUI.tsx, FitnessComponents.tsx) |
| `src/context/` | React Context providers (Theme, Language, Database, Auth) |
| `src/database/` | SQLite schema (v9), CRUD service, types, seed data — **the canonical data layer** |
| `src/engines/` | Workout algorithm + sensor fusion + health analytics + health monitor + anomaly detection + sleep analysis + background health + intent routing |
| `src/security/` | Encrypted DB, biometric auth, secure storage migration |
| `src/fitmind/` | Cognitive fitness module — document library, reader, dual AI, flashcards |
| `src/hooks/` | Custom hooks (`useFitQuestWorkout`, `useWorkoutTimer`, `useSensorFusion`, etc.) |
| `src/design/` | Theme tokens — `theme-system.ts` is canonical source of truth |
| `src/services/` | Apollo clients (legacy), XP service, offline cache, audio/timer services |
| `src/i18n/` | Translation strings (15 languages including SA languages) |
| `store/` | Zustand store (minimal — only `useAuthStore`) |

## Theming — Mandatory Conventions

Every component MUST use the theme system — **never hardcode colors or spacing**.

```tsx
import { useTheme } from '../context/ThemeContext';
const { theme } = useTheme();
// Colors: theme.colors.background, theme.colors.text, theme.colors.accent
// Spacing: theme.spacing[4]  |  Radius: theme.borderRadius.lg
```

**Spacing uses NUMERIC keys**: `{px:1, 0:0, 1:4, 2:8, 3:12, 4:16, 5:20, 6:24, 8:32, 10:40, 12:48}`. Use `theme.spacing[4]` NOT `theme.spacing.md`.
**Border radius uses NAMED keys**: `{none, sm, md, lg, xl, full}`.

Canonical tokens: `src/design/theme-system.ts` (NOT `tokens.ts` — that file has conflicting values).
- Dark mode: matte black `#0A0E17` | Light mode: neutral gray `#F4F5F7`
- Primary accent: `#10B981` (green) | Warning: `#F4A427` | Error: `#EF4444`
- Typography: use `ThemedText` (DEFAULT export) with `variant` (h1–caption) and `color` (primary/secondary/muted/accent) props.
- `GradientButton` props: `title` (string), `variant` ('primary'|'success'|'warning'), `size` ('sm'|'md'|'lg'), `style?` (ViewStyle).

## Data Layer — SQLite First (Schema v14)

All data operations go through `src/database/`:
- **Schema**: `schema.ts` — versioned tables with auto-migration (v14: category rename)
- **Service**: `service.ts` — CRUD module (exercises, profiles, fatigue, sessions, streaks, progress, app state)
- **Types**: `types.ts` — canonical enums (`Category`, `Difficulty`, `TargetMuscle`, `EquipmentItem`, etc.) + `SCHEMA_VERSION = 16`
- **Seed**: `seed.ts` — exercise catalogue seeded on first run
- **Init**: `index.ts` — `initializeDatabase()` creates all tables + seeds exercises + inits encrypted DB

Tables by module:
- **Core**: exercises, exercise_muscles, exercise_equipment, exercise_training_types, exercise_images, user_profile, user_equipment, user_injuries, muscle_fatigue, workout_sessions, session_exercises, progress_records, subscription_state, trial_state, app_state, workout_streaks, daily_steps, jog_sessions, audio_settings, body_craft_algorithms
- **Encrypted (v7)**: encrypted_health_data, encrypted_ai_conversations, encrypted_notes, health_alerts
- **FitMind (v7)**: fitmind_documents, fitmind_reading_sessions, fitmind_annotations, fitmind_flashcards, fitmind_reading_goals, fitmind_reading_streaks
- **Health Monitoring (v8)**: heart_rate_readings, anomaly_log, daily_health_summaries, document_content_hashes

XP is persisted via `src/services/xpService.ts` using the `app_state` SQLite table (100 XP base per workout + 20 per exercise + streak bonus).

## Security Layer (`src/security/`)

- **AESEncryption.ts** — Versioned payload crypto: v2 (legacy CTR+HMAC), v3 (AES-256-GCM). Exports: `encryptV2()`, `decryptV2()`, `encryptV3()`, `decryptV3()`, `isV1Payload()`, `isV2Payload()`, `isV3Payload()`, `decryptV1Legacy()`, `getOrCreateMasterKey()`.
- **EncryptedDatabase.ts** — v3 encrypted storage service: writes v3 AES-GCM and auto-migrates v1/v2 blobs to v3 on read. Singleton: `encryptedDB`. Methods: `storeHealthData()`, `getHealthData()`, `getRecentHealthData()`, `storeAIConversation()`, `createHealthAlert()`, `acknowledgeAlert()`, `getActiveAlerts()`, `migrateAllToV3()`, `shouldRotateKey()`, `secureDelete()`.
- **BiometricAuth.ts** — Biometric-first auth with expo-local-authentication. 5-attempt lockout with exponential backoff, 30-minute session expiry. PBKDF2-hardened passcode (1000 JS iterations), constant-time comparison, emergency wipe after 15 failures. Singleton: `bioAuth`.
- **StorageMigration.ts** — SecureStore-backed credential helpers (no AsyncStorage).
- **AuthContext.tsx** — Rewired to use SecureStore + BiometricAuth. Exposes `authenticateWithBiometrics()`, `setupPasscode()`, `isSessionValid()`. Default user: `user_local_001`.

## Workout Engine (Core Domain)

Three engines in `src/engines/`:
- **workoutGenerator.ts** — Deterministic workout generation (fatigue map, goals, equipment, pattern balance)
- **progressionEngine.ts** — Tracks performance, decides difficulty increases
- **recoveryEngine.ts** — Fatigue tracking, deload detection, daily recovery ticks

Orchestrator: `src/hooks/useFitQuestWorkout.ts` — full lifecycle: generate → start → exercise-by-exercise → complete → XP award.

## Sensor & Health Engines (`src/engines/`)

- **SensorFusionEngine.ts** — Accelerometer + Gyroscope + Pedometer fusion at 10Hz. Activity classification (STATIONARY/WALKING/RUNNING/CYCLING/EXERCISE), step detection, rep counting. Exports `useSensorFusion()` React hook and `sensorFusion` singleton.
- **HealthMonitor.ts** — Daily health tracking: steps, calories, active minutes, weekly workouts. Goals stored in `app_state`. Weekly summaries, goal progress. Singleton: `healthMonitor`.
- **RealisticHealthEngine.ts** — Evidence-based health analytics (static methods, no instantiation). Mifflin-St Jeor BMR, TDEE, Navy body fat estimation, Karvonen heart rate zones, MET-based calorie estimation, macro calculations, recovery scoring (0-100), 1RM estimation (Brzycki), hydration targets, weight goal predictions.

## Advanced Health Engines (`src/engines/`)

- **AnomalyDetector.ts** — Statistical anomaly detection for health metrics. Z-score, IQR, rate-of-change, moving average deviation, multi-metric correlation. Auto-creates encrypted health alerts. Singleton: `anomalyDetector`.
- **SleepAnalysisEngine.ts** — On-device sleep quality analysis. Sleep scoring (0-100), stage estimation, sleep debt, circadian consistency, recovery multiplier (0.5-1.2). Manual + sensor-based sessions. Singleton: `sleepEngine`.
- **BackgroundHealthEngine.ts** — Orchestrates all health subsystems: periodic data collection (5min), anomaly checking (30min), daily summaries, weekly reports. Composite health score (0-100). Singleton: `backgroundHealth`.
- **IntentRouter.ts** — Natural language intent classification & routing. Keyword scoring + context weighting. Routes to: COACH, PROFESSOR, HEALTH, WORKOUT, NAVIGATION, SETTINGS, GENERAL. Entity extraction (exercises, muscle groups, metrics). Singleton: `intentRouter`.

## Health Dashboard (`app/health-dashboard.tsx`)

Unified health & wellness overview screen: composite health score ring, daily metric rings (steps, active minutes, calories, sleep), active anomaly alerts with dismiss, 7-day step + sleep trend bars, recovery/sleep detail cards, quick action buttons. Uses `GlassCard`, `AnimatedCounter`, `PulseDot`, `SectionHeader`, `GradientButton` from GlassUI.

## FitMind Module (`src/fitmind/`)

Cognitive fitness system — Body + Mind dual-intelligence platform.

- **schema.ts** — 6 tables + `FitMindService` static CRUD class. SM-2 spaced repetition for flashcards. Reading analytics (streak, totals).
- **DocumentProcessor.ts** — On-device document import (file/text/URL). Text analysis: Flesch-Kincaid readability scoring, keyword extraction. Files stored in `documentDirectory/fitmind/`.
- **DocumentImportPipeline.ts** — Enhanced import orchestrator: input validation & sanitization (XSS), magic-byte format detection, SHA-256 deduplication, content chunking, batch import with progress callbacks, storage quota enforcement (50MB/file, 500MB total). Singleton: `importPipeline`.
- **ReadingSessionTracker.ts** — Real-time session lifecycle: state machine (IDLE→ACTIVE→PAUSED→COMPLETED), focus scoring, idle detection (2min→auto-pause), WPM tracking, AppState integration, auto-saves to FitMindService. Singleton: `readingTracker`.
- **DualAIEngine.ts** — Two AI personalities: COACH (workout tips, form guidance, motivation) + PROFESSOR (reading comprehension, Socratic prompts, summaries). Template-based response generation with context injection. Conversations stored encrypted. Singleton: `dualAI`.
- **Screens**: `app/fitmind-library.tsx` (document list, filters, stats) + `app/fitmind-reader.tsx` (paginated reader, annotations, AI chat panel).

## i18n

Use `const { t } = useLanguage()` from `src/context/LanguageContext.tsx`. All user-facing strings must use translation keys from `src/i18n/translations.ts`. 15 languages supported (en, af, zu, xh, st, es, fr, de, pt, zh, ja, ko, ar, hi, sw).

## State Management

- **React Context** — primary (Theme, Language, Database, Auth)
- **Zustand** — only `store/useAuthStore.ts` (holds `token`/`user`)
- **SQLite** — persists all domain data (v8 schema)
- **SecureStore** — auth tokens, encryption keys, biometric preferences
- Auth uses local biometric + passcode fallback, no real server validation

## Developer Workflow

```bash
npm start          # Expo dev server (Expo Go or emulator)
npm run android    # Native Android build (requires Android Studio + SDK 31+)
npm run web        # Web preview (fastest for UI iteration)
npx expo start -c  # Clean Metro cache (use after dependency changes)
```

For Reanimated/Lottie/Sensors: use dev-client build (`npx expo prebuild && npx expo run:android`), not Expo Go. Reanimated plugin must be **last** in `babel.config.js` plugins array.

## Code Conventions

- **Components**: PascalCase files, default exports (`Button.tsx`). `ThemedText` is a DEFAULT export.
- **Hooks**: camelCase with `use` prefix, named exports (`useFitQuestWorkout.ts`, `useSensorFusion`)
- **Services/Engines**: Singleton pattern with `getInstance()` or module-level const. Named exports.
- **Contexts**: PascalCase + `Context` suffix → `createContext` + `useX` hook + `XProvider` pattern
- **Sensitive data**: Always use `encryptedDB` methods — never store health/AI data in plain SQLite columns
- **Forms**: `react-hook-form` + `zod` schemas
- **No tests exist yet** — testing infrastructure is planned
