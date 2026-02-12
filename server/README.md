# FitQuest Phase 2/3 — Personal Server (Auth + Backups + Sync)

Purpose: provide a CRUD-only backend that stores **opaque encrypted blobs** for backups and issues server sessions.

This server is intentionally minimal:
- No workout generation logic
- Backup blobs remain opaque ciphertext JSON (the server never decrypts)
- Stores backup records as files under `server/data/backups/<userId>/`
- Stores users + refresh sessions in JSON files under `server/data/`
- Automatically retains only latest N backups per user (default `BACKUP_MAX_VERSIONS=3`)

## Endpoints

- `GET /health`
- `POST /auth/email/register` → `{ accessToken, refreshToken, user }`
- `POST /auth/email/login` → `{ accessToken, refreshToken, user }`
- `POST /auth/refresh` → refresh rotation (returns new `{ accessToken, refreshToken, user }`)
- `POST /auth/logout` → revoke refresh token (204)
- `POST /auth/google` → (optional) verify Google `idToken` then issue session
- `POST /auth/apple` → (optional) verify Apple `idToken` then issue session
- `POST /auth/dev` → dev helper (disabled in `NODE_ENV=production`)
- `GET /me` → current user (requires bearer access token)

- `POST /users/consent` → record consent timestamp
- `POST /users/migrate` → register/update migration device
- `GET /users/export` → export user metadata + backups + migrations
- `DELETE /users/data` → delete user + sessions + backups + migrations

- `POST /backups` → create backup (requires bearer access token)
- `GET /backups` → list backups (requires bearer access token)
- `GET /backups/:id` → fetch backup (requires bearer access token)
- `PUT /backups/:id` → overwrite existing backup blob (requires bearer access token)
- `DELETE /backups/:id` → delete backup (requires bearer access token)

- `GET /sync/state-meta/latest` → latest sync state metadata (requires bearer access token)
- `PUT /sync/state-meta` → upsert state metadata with version/conflict checks (requires bearer access token)
- `GET /sync/events` → list outcome events (`since` + `limit`) (requires bearer access token)
- `POST /sync/events` → append-only outcome event ingestion with dedupe by event id (requires bearer access token)

All authenticated routes require `Authorization: Bearer <accessToken>`.

## Run

From `server/`:

- `cp .env.example .env`
- set strong secrets in `.env`
- `npm install`
- `npm run dev`

Smoke tests:
- `npm run smoke:phase2`
- `npm run smoke:phase3`

Server listens on `http://localhost:8787`.

## Notes

For a personal server, you still want TLS (Caddy/nginx), process manager (systemd/pm2), and firewall rules.

## Environment

- `AUTH_JWT_SECRET` (required)
- `AUTH_REFRESH_PEPPER` (required)
- `PORT` (optional, default `8787`)
- `NODE_ENV` (optional)
- `BACKUP_MAX_VERSIONS` (optional, default `3`)

