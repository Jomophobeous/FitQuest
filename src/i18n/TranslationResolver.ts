/**
 * Translation Resolver Stub
 * Resolves exercise translations for the current language.
 * Returns fallback (original) text for all queries.
 */

export interface ResolvedTranslation {
  name: string;
  instructions: string[];
  audioIntro?: string;
  audioSetup?: string;
  audioExecution?: string;
  audioTransition?: string;
  isFallback: boolean;
}

class TranslationResolver {
  async preloadLanguage(_lang: string): Promise<void> {
    // no-op
  }

  async resolveBatch(_ids: string[], _lang: string): Promise<Map<string, ResolvedTranslation>> {
    return new Map();
  }

  async resolve(_id: string, _lang: string): Promise<ResolvedTranslation | null> {
    return null;
  }
}

export const translationResolver = new TranslationResolver();
