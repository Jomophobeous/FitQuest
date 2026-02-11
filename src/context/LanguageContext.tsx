/**
 * FitQuest Language Context
 * Provides i18n translation support with persistent language selection
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, SUPPORTED_LANGUAGES } from '../i18n/translations';

const LANGUAGE_STORAGE_KEY = 'fitquest.language';

interface LanguageContextType {
  language: string;
  setLanguage: (code: string) => void;
  t: (key: string) => string;
  languageName: string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<string>('en');

  // Load saved language on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
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
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
    } catch (e) {
      console.warn('Failed to save language preference:', e);
    }
  }, []);

  const t = useCallback(
    (key: string): string => {
      const langStrings = translations[language];
      if (langStrings && langStrings[key]) return langStrings[key];
      // Fallback to English
      const enStrings = translations.en;
      if (enStrings && enStrings[key]) return enStrings[key];
      // Return key as last resort
      return key;
    },
    [language],
  );

  const languageName =
    SUPPORTED_LANGUAGES.find((l) => l.code === language)?.name || 'English';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languageName }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
