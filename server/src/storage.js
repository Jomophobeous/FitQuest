import fs from 'node:fs/promises';
import path from 'node:path';

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readJsonOrDefault(filePath, defaultValue) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return defaultValue;
    throw e;
  }
}

async function writeJsonAtomic(filePath, obj) {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(obj), 'utf8');
  await fs.rename(tmp, filePath);
}

export class JsonStorage {
  constructor(options) {
    this.dataDir = options.dataDir;
    this.usersFile = path.join(this.dataDir, 'users.json');
    this.refreshSessionsFile = path.join(this.dataDir, 'refresh_sessions.json');
    this.migrationsFile = path.join(this.dataDir, 'migrations.json');
    this.syncStateMetaFile = path.join(this.dataDir, 'sync_state_meta.json');
    this.syncEventsFile = path.join(this.dataDir, 'sync_events.json');
    this.analyticsBucketsFile = path.join(this.dataDir, 'analytics_buckets.json');
  }

  async init() {
    await ensureDir(this.dataDir);
    await Promise.all([
      this._ensureFile(this.usersFile, { users: [] }),
      this._ensureFile(this.refreshSessionsFile, { sessions: [] }),
      this._ensureFile(this.migrationsFile, { migrations: [] }),
      this._ensureFile(this.syncStateMetaFile, { stateMetas: [] }),
      this._ensureFile(this.syncEventsFile, { events: [] }),
      this._ensureFile(this.analyticsBucketsFile, { buckets: [] }),
    ]);
  }

  async _ensureFile(filePath, initialValue) {
    const existing = await readJsonOrDefault(filePath, null);
    if (existing === null) await writeJsonAtomic(filePath, initialValue);
  }

  async getUsers() {
    const data = await readJsonOrDefault(this.usersFile, { users: [] });
    return Array.isArray(data.users) ? data.users : [];
  }

  async saveUsers(users) {
    await writeJsonAtomic(this.usersFile, { users });
  }

  async getRefreshSessions() {
    const data = await readJsonOrDefault(this.refreshSessionsFile, { sessions: [] });
    return Array.isArray(data.sessions) ? data.sessions : [];
  }

  async saveRefreshSessions(sessions) {
    await writeJsonAtomic(this.refreshSessionsFile, { sessions });
  }

  async getMigrations() {
    const data = await readJsonOrDefault(this.migrationsFile, { migrations: [] });
    return Array.isArray(data.migrations) ? data.migrations : [];
  }

  async saveMigrations(migrations) {
    await writeJsonAtomic(this.migrationsFile, { migrations });
  }

  async getSyncStateMetas() {
    const data = await readJsonOrDefault(this.syncStateMetaFile, { stateMetas: [] });
    return Array.isArray(data.stateMetas) ? data.stateMetas : [];
  }

  async saveSyncStateMetas(stateMetas) {
    await writeJsonAtomic(this.syncStateMetaFile, { stateMetas });
  }

  async getSyncEvents() {
    const data = await readJsonOrDefault(this.syncEventsFile, { events: [] });
    return Array.isArray(data.events) ? data.events : [];
  }

  async saveSyncEvents(events) {
    await writeJsonAtomic(this.syncEventsFile, { events });
  }

  async getAnalyticsBuckets() {
    const data = await readJsonOrDefault(this.analyticsBucketsFile, { buckets: [] });
    return Array.isArray(data.buckets) ? data.buckets : [];
  }

  async saveAnalyticsBuckets(buckets) {
    await writeJsonAtomic(this.analyticsBucketsFile, {
      buckets,
      updatedAt: Date.now(),
    });
  }
}
