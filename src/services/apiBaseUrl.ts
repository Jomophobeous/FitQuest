function sanitizeBaseUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Validate URL structure and enforce HTTPS-only
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    if (__DEV__) console.warn('[apiBaseUrl] Invalid URL:', trimmed);
    return null;
  }

  if (parsed.protocol !== 'https:') {
    // Allow http only in development (localhost / emulator)
    if (!__DEV__ || parsed.protocol !== 'http:') {
      if (__DEV__) console.warn('[apiBaseUrl] Rejected non-HTTPS URL:', trimmed);
      return null;
    }
  }

  return parsed.origin + parsed.pathname.replace(/\/+$/, '');
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
