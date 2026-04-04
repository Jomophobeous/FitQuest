/**
 * FitQuest Internationalization — Modular Translation Index
 *
 * Active languages: en, es, fr, zh (4)
 * Disabled languages preserved in ./disabled/ for future activation
 *
 * To re-enable a language:
 * 1. Move it from disabled/ to this directory
 * 2. Import it below
 * 3. Add to translations + SUPPORTED_LANGUAGES
 */

import en from './en';
import es from './es';
import fr from './fr';
import zh from './zh';

export type { TranslationKey } from './en';

export const translations: Record<string, Record<string, string>> = {
  en,
  es,
  fr,
  zh,
};

export interface LanguageInfo {
  code: string;
  name: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];
