/**
 * FSRS Service Stub — Free Spaced Repetition Scheduler
 * Used by FitMind flashcard system.
 */

export interface FSRSCard {
  difficulty: number;
  stability: number;
  due: number;
  reps: number;
  lapses: number;
  state: number;
}

class FSRSService {
  scheduleReview(card: Record<string, unknown>, rating: string): { card: FSRSCard } {
    return {
      card: {
        difficulty: 2.5,
        stability: 1,
        due: Date.now() + 86400000,
        reps: 0,
        lapses: 0,
        state: 0,
      },
    };
  }
}

export const fsrsService = new FSRSService();
