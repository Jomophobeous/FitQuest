import { describe, it, expect } from 'vitest';
import { translations } from '../src/i18n/translations';

const SUPPORTED_LANGUAGES = [
  'en', 'af', 'zu', 'xh', 'st', 'es', 'fr', 'de', 'pt',
  'zh', 'ja', 'ko', 'ar', 'hi', 'sw',
];

const ENGINE_KEY_PREFIXES = [
  'signal.',
  'memory.',
  'trial.',
  'failure.',
  'simulation.',
  'gating.',
];

describe('Translation Completeness', () => {
  const enTranslations = translations.en;
  const enKeys = enTranslations ? Object.keys(enTranslations) : [];
  const engineKeys = enKeys.filter((k) =>
    ENGINE_KEY_PREFIXES.some((p) => k.startsWith(p))
  );

  it('English has all 113 engine keys', () => {
    expect(engineKeys.length).toBe(113);
  });

  for (const lang of SUPPORTED_LANGUAGES) {
    it(`${lang} is present in translations`, () => {
      expect(translations[lang]).toBeDefined();
    });

    if (lang === 'en') continue;

    it(`${lang} has all engine keys`, () => {
      const langData = translations[lang];
      if (!langData) return;
      const langKeys = Object.keys(langData);
      const missing = engineKeys.filter((k) => !langKeys.includes(k));
      expect(missing).toEqual([]);
    });

    it(`${lang} engine keys have non-empty values`, () => {
      const langData = translations[lang];
      if (!langData) return;
      const empty = engineKeys.filter(
        (k) => langData[k] !== undefined && langData[k].trim() === ''
      );
      expect(empty).toEqual([]);
    });

    it(`${lang} preserves {{variable}} placeholders`, () => {
      const langData = translations[lang];
      if (!langData || !enTranslations) return;
      const broken: string[] = [];
      for (const key of engineKeys) {
        const enVal = enTranslations[key];
        const langVal = langData[key];
        if (!enVal || !langVal) continue;
        const enVars = (enVal.match(/\{\{[^}]+\}\}/g) || []).sort();
        const langVars = (langVal.match(/\{\{[^}]+\}\}/g) || []).sort();
        if (JSON.stringify(enVars) !== JSON.stringify(langVars)) {
          broken.push(`${key}: en=${JSON.stringify(enVars)} ${lang}=${JSON.stringify(langVars)}`);
        }
      }
      expect(broken).toEqual([]);
    });
  }
});
