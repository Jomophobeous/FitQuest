export function getEnv(name, options = {}) {
  const raw = process.env[name];
  const trimmed = typeof raw === 'string' ? raw.trim() : '';

  if (!trimmed) {
    if (options.optional) return null;
    throw new Error(`[config] Missing required env var: ${name}`);
  }
  return trimmed;
}

export function getNumberEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
