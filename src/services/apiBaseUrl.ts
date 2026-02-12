function sanitizeBaseUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '');
}

/**
 * Single base URL for the personal server.
 *
 * Back-compat: falls back to EXPO_PUBLIC_BACKUP_API_BASE_URL if EXPO_PUBLIC_API_BASE_URL is not set.
 */
export function getApiBaseUrl(): string | null {
  return (
    sanitizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL) ||
    sanitizeBaseUrl(process.env.EXPO_PUBLIC_BACKUP_API_BASE_URL)
  );
}

export function requireApiBaseUrl(): string {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error('Missing EXPO_PUBLIC_API_BASE_URL');
  return baseUrl;
}
