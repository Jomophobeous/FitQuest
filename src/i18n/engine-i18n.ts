/**
 * Non-React i18n Bridge
 *
 * Provides a module-level t() function for use in engines, services,
 * and any non-React code that needs translated strings.
 *
 * Language is synchronized from LanguageContext via setCurrentLanguage().
 * Falls back to English if key is missing.
 *
 * Usage in engines:
 *   import { t, tKey } from '../i18n/engine-i18n';
 *   t('signal.firstSession.headline')
 *   t('signal.streak', { count: '5' })
 *   tKey('signal.firstSession.headline', { count: '5' }) // returns { key, params } for deferred rendering
 */

import { translations } from './translations';

// ============================================
// STATE
// ============================================

let _currentLanguage = 'en';

// ============================================
// LANGUAGE SYNC
// ============================================

/**
 * Set the current language for engine-side translations.
 * Called by LanguageContext when language changes.
 */
export function setCurrentLanguage(lang: string): void {
  if (translations[lang]) {
    _currentLanguage = lang;
  }
}

/**
 * Get the current language code.
 */
export function getCurrentLanguage(): string {
  return _currentLanguage;
}

// ============================================
// TRANSLATION FUNCTION
// ============================================

/**
 * Translate a key with optional variable interpolation.
 * Uses current language, falls back to English, falls back to key itself.
 *
 * @param key - Translation key (e.g., 'signal.firstSession.headline')
 * @param vars - Variables to interpolate (replaces {{var}} in string)
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const langStrings = translations[_currentLanguage];
  let result: string;

  if (langStrings && langStrings[key]) {
    result = langStrings[key];
  } else {
    // Fallback to English
    const enStrings = translations.en;
    result = enStrings?.[key] ?? key;
  }

  // Interpolation
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    }
  }

  return result;
}

// ============================================
// DEFERRED KEY (template-driven output)
// ============================================

export interface TranslationRef {
  key: string;
  params?: Record<string, string | number>;
}

/**
 * Create a translation reference for deferred rendering.
 * Engines return { key, params } instead of raw strings.
 * UI resolves via t(ref.key, ref.params).
 */
export function tKey(key: string, params?: Record<string, string | number>): TranslationRef {
  return { key, params };
}

/**
 * Resolve a TranslationRef to a translated string.
 */
export function resolveRef(ref: TranslationRef): string {
  return t(ref.key, ref.params);
}
