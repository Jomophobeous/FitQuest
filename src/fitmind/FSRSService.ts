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
  scheduled_days: number;
  learning_steps: number;
  last_review: number;
}

class FSRSService {
  scheduleReview(_card: Record<string, unknown>, _rating: string): { card: FSRSCard } {
    return {
      card: {
        difficulty: 2.5,
        stability: 1,
        due: Date.now() + 86400000,
        reps: 0,
        lapses: 0,
        state: 0,
        scheduled_days: 1,
        learning_steps: 0,
        last_review: Date.now(),
      },
    };
  }
}

export const fsrsService = new FSRSService();
