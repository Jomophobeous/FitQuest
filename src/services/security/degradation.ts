/**
 * Degradation Stub — no-op security degradation
 */
export const degradation = {
  applyAIDelay: async (_riskLevel: string): Promise<void> => {},
  shouldDowngradeAI: (_riskLevel: string): boolean => false,
  getFallbackResponse: () => 'AI is temporarily unavailable.',
  injectSubtleFailure: (text: string): string => text,
};
