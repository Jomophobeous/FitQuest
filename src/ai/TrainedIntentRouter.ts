/**
 * Trained Intent Router Stub
 * ML-based intent classification — stub returns low confidence to fall through to keyword classifier.
 */

export interface MLClassifyResult {
  intent: string;
  confidence: number;
  alternatives: { intent: string; confidence: number }[];
}

class TrainedIntentRouter {
  loaded = false;

  async initialize(): Promise<boolean> {
    return false;
  }

  classify(_query: string): MLClassifyResult {
    return { intent: 'GENERAL', confidence: 0, alternatives: [] };
  }
}

export const trainedIntentRouter = new TrainedIntentRouter();
