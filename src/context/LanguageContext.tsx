/**
 * FitQuest Language Context
 * Provides i18n translation support with persistent language selection
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { translations, SUPPORTED_LANGUAGES } from '../i18n/translations';

const LANGUAGE_STORAGE_KEY = 'fitquest.language';

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
        }
      } catch (e) {
        console.warn('Failed to load language preference:', e);
      }
    })();
  }, []);

  const setLanguage = useCallback(async (code: string) => {
    if (!translations[code]) return;
    setLanguageState(code);
    try {
      await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, code);
    } catch (e) {
      console.warn('Failed to save language preference:', e);
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
        result = (enStrings && enStrings[key]) ? enStrings[key] : key;
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

  const languageName = useMemo(() =>
    SUPPORTED_LANGUAGES.find((l) => l.code === language)?.name || 'English',
    [language]
  );

  const contextValue = useMemo(() => ({
    language, setLanguage, t, languageName,
  }), [language, setLanguage, t, languageName]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
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
        let result = enStrings?.[key] || key;
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
