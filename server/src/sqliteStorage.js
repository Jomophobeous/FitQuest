/**
 * SQLite-backed storage — drop-in replacement for JsonStorage.
 *
 * Same public API (getUsers, saveUsers, etc.) but backed by a single
 * better-sqlite3 database with proper indexing and ACID transactions.
 *
 * Migration: On first init, if JSON data files exist they are imported
 * into SQLite and the originals are renamed to *.json.bak.
 */

import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
import path from 'node:path';

function readJsonSync(filePath) {
  try {
    const raw = require('node:fs').readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export class SqliteStorage {
  /** @param {{ dataDir: string }} options */
  constructor(options) {
    this.dataDir = options.dataDir;
    this.dbPath = path.join(this.dataDir, 'fitquest.db');
    this.db = null;
  }

  async init() {
    await fs.mkdir(this.dataDir, { recursive: true });
    this.db = new Database(this.dbPath);

    // Performance pragmas
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('foreign_keys = ON');

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password_hash TEXT,
        provider TEXT DEFAULT 'local',
        provider_sub TEXT,
        goal TEXT,
        experience TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        data TEXT NOT NULL DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

      CREATE TABLE IF NOT EXISTS refresh_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        issued_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked INTEGER DEFAULT 0,
        data TEXT NOT NULL DEFAULT '{}',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_rs_user ON refresh_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_rs_token ON refresh_sessions(token_hash);

      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        data TEXT NOT NULL DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_mig_user ON migrations(user_id);

      CREATE TABLE IF NOT EXISTS sync_state_meta (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        data TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_ssm_user ON sync_state_meta(user_id);

      CREATE TABLE IF NOT EXISTS sync_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        data TEXT NOT NULL DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_se_user ON sync_events(user_id);

      CREATE TABLE IF NOT EXISTS analytics_buckets (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // Migrate from JSON files if they exist
    await this._migrateFromJson();
  }

  // ─── JSON Migration ──────────────────────────────────

  async _migrateFromJson() {
    const usersFile = path.join(this.dataDir, 'users.json');
    const jsonData = readJsonSync(usersFile);
    if (!jsonData) return; // No JSON files to migrate

    console.log('[SqliteStorage] Migrating JSON data to SQLite...');

    const insertInTransaction = this.db.transaction(() => {
      // Users
      const usersJson = readJsonSync(usersFile);
      if (usersJson?.users?.length) {
        const stmt = this.db.prepare(
          `INSERT OR IGNORE INTO users (id, email, password_hash, provider, provider_sub, goal, experience, created_at, data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const u of usersJson.users) {
          stmt.run(u.id, u.email, u.passwordHash, u.provider || 'local',
            u.providerSub || null, u.goal || null, u.experience || null,
            u.createdAt || new Date().toISOString(), JSON.stringify(u));
        }
      }

      // Refresh sessions
      const sessionsJson = readJsonSync(path.join(this.dataDir, 'refresh_sessions.json'));
      if (sessionsJson?.sessions?.length) {
        const stmt = this.db.prepare(
          `INSERT OR IGNORE INTO refresh_sessions (id, user_id, token_hash, issued_at, expires_at, revoked)
           VALUES (?, ?, ?, ?, ?, ?)`
        );
        for (const s of sessionsJson.sessions) {
          stmt.run(s.id || crypto.randomUUID(), s.userId, s.tokenHash,
            s.issuedAt, s.expiresAt, s.revoked ? 1 : 0);
        }
      }

      // Migrations
      const migrationsJson = readJsonSync(path.join(this.dataDir, 'migrations.json'));
      if (migrationsJson?.migrations?.length) {
        const stmt = this.db.prepare(
          `INSERT OR IGNORE INTO migrations (id, user_id, data, created_at)
           VALUES (?, ?, ?, ?)`
        );
        for (const m of migrationsJson.migrations) {
          stmt.run(m.id || crypto.randomUUID(), m.userId,
            JSON.stringify(m), m.createdAt || new Date().toISOString());
        }
      }

      // Sync state meta
      const syncMetaJson = readJsonSync(path.join(this.dataDir, 'sync_state_meta.json'));
      if (syncMetaJson?.stateMetas?.length) {
        const stmt = this.db.prepare(
          `INSERT OR IGNORE INTO sync_state_meta (id, user_id, data, updated_at)
           VALUES (?, ?, ?, ?)`
        );
        for (const m of syncMetaJson.stateMetas) {
          stmt.run(m.id || crypto.randomUUID(), m.userId,
            JSON.stringify(m), m.updatedAt || new Date().toISOString());
        }
      }

      // Sync events
      const syncEventsJson = readJsonSync(path.join(this.dataDir, 'sync_events.json'));
      if (syncEventsJson?.events?.length) {
        const stmt = this.db.prepare(
          `INSERT OR IGNORE INTO sync_events (id, user_id, data, created_at)
           VALUES (?, ?, ?, ?)`
        );
        for (const e of syncEventsJson.events) {
          stmt.run(e.id || crypto.randomUUID(), e.userId,
            JSON.stringify(e), e.createdAt || new Date().toISOString());
        }
      }

      // Analytics buckets
      const bucketsJson = readJsonSync(path.join(this.dataDir, 'analytics_buckets.json'));
      if (bucketsJson?.buckets?.length) {
        const stmt = this.db.prepare(
          `INSERT OR IGNORE INTO analytics_buckets (id, data, updated_at)
           VALUES (?, ?, ?)`
        );
        for (const b of bucketsJson.buckets) {
          stmt.run(b.id || crypto.randomUUID(),
            JSON.stringify(b), new Date().toISOString());
        }
      }
    });

    insertInTransaction();

    // Rename JSON files to .bak
    const jsonFiles = ['users.json', 'refresh_sessions.json', 'migrations.json',
      'sync_state_meta.json', 'sync_events.json', 'analytics_buckets.json'];
    for (const f of jsonFiles) {
      const filePath = path.join(this.dataDir, f);
      try {
        await fs.rename(filePath, `${filePath}.bak`);
      } catch { /* file may not exist */ }
    }

    console.log('[SqliteStorage] Migration complete.');
  }

  // ─── Users ─────────────────────────────────────────────

  async getUsers() {
    return this.db.prepare('SELECT data FROM users').all()
      .map(r => JSON.parse(r.data));
  }

  async saveUsers(users) {
    const save = this.db.transaction((list) => {
      this.db.prepare('DELETE FROM users').run();
      const stmt = this.db.prepare(
        `INSERT INTO users (id, email, password_hash, provider, provider_sub, goal, experience, created_at, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const u of list) {
        stmt.run(u.id, u.email, u.passwordHash, u.provider || 'local',
          u.providerSub || null, u.goal || null, u.experience || null,
          u.createdAt || new Date().toISOString(), JSON.stringify(u));
      }
    });
    save(users);
  }

  // ─── Refresh Sessions ─────────────────────────────────

  async getRefreshSessions() {
    return this.db.prepare('SELECT data FROM refresh_sessions').all()
      .map(r => JSON.parse(r.data));
  }

  async saveRefreshSessions(sessions) {
    const save = this.db.transaction((list) => {
      this.db.prepare('DELETE FROM refresh_sessions').run();
      const stmt = this.db.prepare(
        `INSERT INTO refresh_sessions (id, user_id, token_hash, issued_at, expires_at, revoked, data)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const s of list) {
        stmt.run(s.id || crypto.randomUUID(), s.userId, s.tokenHash,
          s.issuedAt, s.expiresAt, s.revoked ? 1 : 0, JSON.stringify(s));
      }
    });
    save(sessions);
  }

  // ─── Migrations ────────────────────────────────────────

  async getMigrations() {
    return this.db.prepare('SELECT data FROM migrations').all()
      .map(r => JSON.parse(r.data));
  }

  async saveMigrations(migrations) {
    const save = this.db.transaction((list) => {
      this.db.prepare('DELETE FROM migrations').run();
      const stmt = this.db.prepare(
        `INSERT INTO migrations (id, user_id, data, created_at)
         VALUES (?, ?, ?, ?)`
      );
      for (const m of list) {
        stmt.run(m.id || crypto.randomUUID(), m.userId,
          JSON.stringify(m), m.createdAt || new Date().toISOString());
      }
    });
    save(migrations);
  }

  // ─── Sync State Metas ─────────────────────────────────

  async getSyncStateMetas() {
    return this.db.prepare('SELECT data FROM sync_state_meta').all()
      .map(r => JSON.parse(r.data));
  }

  async saveSyncStateMetas(stateMetas) {
    const save = this.db.transaction((list) => {
      this.db.prepare('DELETE FROM sync_state_meta').run();
      const stmt = this.db.prepare(
        `INSERT INTO sync_state_meta (id, user_id, data, updated_at)
         VALUES (?, ?, ?, ?)`
      );
      for (const m of list) {
        stmt.run(m.id || crypto.randomUUID(), m.userId,
          JSON.stringify(m), m.updatedAt || new Date().toISOString());
      }
    });
    save(stateMetas);
  }

  // ─── Sync Events ───────────────────────────────────────

  async getSyncEvents() {
    return this.db.prepare('SELECT data FROM sync_events').all()
      .map(r => JSON.parse(r.data));
  }

  async saveSyncEvents(events) {
    const save = this.db.transaction((list) => {
      this.db.prepare('DELETE FROM sync_events').run();
      const stmt = this.db.prepare(
        `INSERT INTO sync_events (id, user_id, data, created_at)
         VALUES (?, ?, ?, ?)`
      );
      for (const e of list) {
        stmt.run(e.id || crypto.randomUUID(), e.userId,
          JSON.stringify(e), e.createdAt || new Date().toISOString());
      }
    });
    save(events);
  }

  // ─── Analytics Buckets ─────────────────────────────────

  async getAnalyticsBuckets() {
    return this.db.prepare('SELECT data FROM analytics_buckets').all()
      .map(r => JSON.parse(r.data));
  }

  async saveAnalyticsBuckets(buckets) {
    const save = this.db.transaction((list) => {
      this.db.prepare('DELETE FROM analytics_buckets').run();
      const stmt = this.db.prepare(
        `INSERT INTO analytics_buckets (id, data, updated_at)
         VALUES (?, ?, ?)`
      );
      for (const b of list) {
        stmt.run(b.id || crypto.randomUUID(),
          JSON.stringify(b), new Date().toISOString());
      }
    });
    save(buckets);
  }

  // ─── Cleanup ───────────────────────────────────────────

  close() {
    if (this.db) this.db.close();
  }
}
