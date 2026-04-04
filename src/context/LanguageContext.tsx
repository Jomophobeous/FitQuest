/**
 * FitQuest Language Context
 * Provides i18n translation support with persistent language selection
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { I18nManager } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates';
import { translations, SUPPORTED_LANGUAGES } from '../i18n/translations';
import { audioService } from '../services/audioService';

const LANGUAGE_STORAGE_KEY = 'fitquest.language';

/** Languages that use right-to-left script */
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur']);

interface LanguageContextType {
  language: string;
  setLanguage: (code: string) => void;
  /** Translate a key, with optional interpolation: t('key', { name: 'val' }) replaces {{name}} */
  t: (key: string, vars?: Record<string, string | number>) => string;
  languageName: string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<string>('en');

  // Load saved language on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
        if (saved && translations[saved]) {
          setLanguageState(saved);
          // Ensure RTL is correct for restored language
          const needsRTL = RTL_LANGUAGES.has(saved);
          if (I18nManager.isRTL !== needsRTL) {
            I18nManager.allowRTL(true);
            I18nManager.forceRTL(needsRTL);
          }
        }
      } catch (e) {
        if (__DEV__) console.warn('Failed to load language preference:', e);
      }
    })();
  }, []);

  const setLanguage = useCallback(async (code: string) => {
    if (!translations[code]) return;
    setLanguageState(code);
    try {
      await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, code);
    } catch (e) {
      if (__DEV__) console.warn('Failed to save language preference:', e);
    }

    // Handle RTL layout direction change
    const needsRTL = RTL_LANGUAGES.has(code);
    if (I18nManager.isRTL !== needsRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(needsRTL);
      // React Native requires an app reload for RTL to take effect
      try {
        await Updates.reloadAsync();
      } catch {
        // In dev mode or if updates unavailable — user must restart manually
        if (__DEV__) console.warn('[i18n] RTL change requires app restart');
      }
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const langStrings = translations[language];
      let result: string;
      if (langStrings && langStrings[key]) {
        result = langStrings[key];
      } else {
        // Fallback to English
        const enStrings = translations.en;
        if (enStrings && enStrings[key]) {
          result = enStrings[key];
        } else {
          // Key missing from all translations — return empty string so || fallback chains work
          if (__DEV__) console.warn(`[i18n] Missing translation key: "${key}"`);
          result = '';
        }
      }
      // Interpolation: replace {{var}} with value
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
        }
      }
      return result;
    },
    [language],
  );

  const languageName = useMemo(
    () => SUPPORTED_LANGUAGES.find((l) => l.code === language)?.name || 'English',
    [language],
  );

  const contextValue = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      languageName,
    }),
    [language, setLanguage, t, languageName],
  );

  // Keep audioService TTS language in sync
  useEffect(() => {
    audioService.setLanguage(language);
    audioService.setTranslator(t);
  }, [language, t]);

  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Return safe defaults if used outside provider (during initial render)
    return {
      language: 'en',
      setLanguage: () => {},
      t: (key: string, vars?: Record<string, string | number>) => {
        const enStrings = translations.en;
        let result = enStrings?.[key] || '';
        if (vars) {
          for (const [k, v] of Object.entries(vars)) {
            result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
          }
        }
        return result;
      },
      languageName: 'English',
    };
  }
  return context;
}
