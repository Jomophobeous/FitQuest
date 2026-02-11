# Phase 2 — State Persistence (Minimal Backend) Checklist

Purpose
- Provide minimal cloud persistence to prevent data loss and enable device migration without changing FitQuest's client-driven generation model.

Principles
- Server is CRUD-only for encrypted user state and metadata.
- No workout generation or personalization logic on server.
- Keep telemetry and analytics OFF unless Phase 4 is explicitly approved.
- Design for simple rollback and data portability.

Scope
- Auth: Email + Apple + Google (OAuth)
- Encrypted user-state storage (server stores encrypted blob)
- Manual backup / restore UI and automatic periodic backup
- Minimal REST/GraphQL CRUD API for user-state blobs only
- PostgreSQL for user metadata and pointers; object storage (optional) for backups

Security & Privacy
- All user state encrypted client-side before upload (AES-256-GCM). Server stores opaque blob.
- Auth tokens short-lived; refresh tokens stored securely (server-side optional).
- End-to-end design: server cannot read workout state.
- GDPR/CCPA: provide export/delete endpoints; record consent timestamp.

Auth Options & Flow
1. Email (magic link or password) — required for users without Apple/Google.
2. Apple Sign In — iOS native flow.
3. Google Sign In — Android/Google ecosystem.

Recommended flow:
- Client authenticates with provider → receives ID token
- Client sends ID token to backend auth endpoint for account creation/lookup
- Server returns a session JWT (short-lived) + refresh token
- Client stores refresh token securely (SecureStore); refresh flow rotates refresh token

Data Model (minimal)
- users: id, provider_id, email_hash, created_at, last_login
- backups: id, user_id, blob_location (or blob), version, created_at
- migrations: user_id, device_id, last_synced_at

API Endpoints (CRUD only)
- POST /auth/:provider (exchange token, create session)
- POST /backups         (create backup blob)
- GET  /backups/:id     (fetch backup blob)
- GET  /backups         (list backups for user)
- PUT  /backups/:id     (overwrite / restore)
- DELETE /backups/:id   (delete backup)
- POST /users/migrate   (register device for migration)

Backup Strategy
- Client-side: Serialize `FitQuestState` → compress → encrypt → upload
- Automatic schedule: once per day, on logout, on profile change
- Manual restore: choose backup from list, validate crypto, decrypt
- Versioning: keep N latest (configurable, e.g., N=3)
- Conflict handling: use timestamp + version ID; prompt user on ambiguous merges

Encryption Details
- Client generates a per-user encryption key derived from a random salt stored in SecureStore
- Use AES-256-GCM; maintain IV per blob
- Consider optional passphrase backup for cross-account restores

Migration / Restore UX
- Device A: Create backup → Device B: Sign in → show available backups → user selects → decrypt locally and import
- If user changes profile, require a new backup to be created

Operational Considerations
- Keep server stateless where possible
- Use managed DB (Postgres) and managed object storage (S3-compatible)
- Keep backups immutable once created (create new version on change)

Testing & Acceptance Criteria
- E2E test: Signup → create backup → sign in on new device → restore → state matches (hash of restored state)
- Security test: Server cannot decrypt the blob (verify via code review)
- Failure test: Simulate partial upload and verify client handles retries and does not corrupt local state
- Privacy test: Export/Delete endpoints work and remove data

Rollout Plan
- Phase 2 alpha: internal test with small user set (10–50 users)
- Phase 2 beta: 500 users (monitor restore success, auth issues)
- Public rollout: after metrics show <1% restore failure and auth success rate >99%

Monitoring & Metrics (minimal)
- Backup success rate
- Restore success rate
- Auth success / failure rates
- Rate of manual restores (indicative of device migration)

Costs & Tech Recommendations
- Supabase minimal project (Auth + Postgres + Storage) — fastest route
- Firebase alternative if you prefer managed auth + storage
- Custom API: use minimal server (Node/Go) with Postgres + S3; requires more ops

Developer Checklist (implementation steps)
1. Define `FitQuestState` serialization format and stable schema versioning.
2. Implement client-side encryption & key management.
3. Add backup UI: manual backup, list of backups, restore flow.
4. Implement backend CRUD endpoints (or configure Supabase storage).
5. Add auth (email, Apple, Google) and connect to backups.
6. Add E2E tests for backup/restore and auth flows.
7. Perform security review and privacy sign-off.
8. Roll out alpha → beta → public as per rollout plan.

Exit Criteria
- Users trust app for long-term history (restore success rate high)
- Device migration becomes common and reliable

References
- OBJECTIVES.md
- PHASE3_SYNC_GUIDE.md (placeholder)

Created: 2026-02-05
