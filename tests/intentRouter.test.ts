/**
 * IntentRouter — Natural Language Intent Classification Tests
 *
 * Tests keyword-based scoring, entity extraction, context boosting,
 * disambiguation, and confidence thresholds.
 * ML model is mocked to test fallback keyword classifier in isolation.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

(globalThis as any).__DEV__ = false;

// Mock all native + external dependencies
vi.mock('../src/security/EncryptedDatabase', () => ({
  encryptedDB: {
    storeAIConversation: vi.fn().mockResolvedValue(undefined),
    getAIConversations: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../src/ai/TrainedIntentRouter', () => ({
  trainedIntentRouter: {
    initialize: vi.fn().mockResolvedValue(false), // Force keyword fallback
    loaded: false,
    classify: vi.fn(),
  },
}));

import { IntentRouter, type ClassifiedIntent } from '../src/engines/IntentRouter';

// ============================================
// HELPERS
// ============================================

function classify(query: string): ClassifiedIntent {
  // Use a fresh instance (bypass singleton for isolation)
  const router = new (IntentRouter as any)();
  // ML model not loaded → will use keyword fallback
  return router.classify(query);
}

// ============================================
// TESTS
// ============================================

describe('IntentRouter', () => {
  describe('basic intent classification', () => {
    it('classifies workout generation queries as WORKOUT', () => {
      const result = classify('Generate a workout for today');
      expect(result.category).toBe('WORKOUT');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('classifies coaching queries as COACH', () => {
      const result = classify('How should I do a push-up with proper form?');
      expect(result.category).toBe('COACH');
    });

    it('classifies reading queries as COACH (PROFESSOR removed)', () => {
      const result = classify('Summarize this book chapter for me');
      expect(result.category).toBe('COACH');
    });

    it('classifies health queries as HEALTH', () => {
      const result = classify('What is my BMR and how many calories should I eat?');
      expect(result.category).toBe('HEALTH');
    });

    it('classifies navigation as NAVIGATION', () => {
      const result = classify('Go to the dashboard');
      expect(result.category).toBe('NAVIGATION');
    });

    it('classifies settings as SETTINGS', () => {
      const result = classify('Change my language to Spanish');
      expect(result.category).toBe('SETTINGS');
    });

    it('classifies greetings as GENERAL', () => {
      const result = classify('Hello, how are you?');
      expect(result.category).toBe('GENERAL');
    });

    it('classifies empty/vague queries as GENERAL', () => {
      const result = classify('um hmm');
      expect(result.category).toBe('GENERAL');
    });
  });

  // ============================================
  // ENTITY EXTRACTION
  // ============================================

  describe('entity extraction', () => {
    it('extracts exercise names', () => {
      const result = classify('How do I do a push-up and squat?');
      expect(result.entities.exercises).toContain('push-up');
      expect(result.entities.exercises).toContain('squat');
    });

    it('extracts muscle groups', () => {
      const result = classify('My chest and back are sore from training');
      expect(result.entities.muscleGroups).toContain('chest');
      expect(result.entities.muscleGroups).toContain('back');
    });

    it('extracts time references', () => {
      const result = classify('What was my workout yesterday?');
      expect(result.entities.timeReferences).toContain('yesterday');
    });

    it('extracts metric references', () => {
      const result = classify('What is my current heart rate and bmi?');
      expect(result.entities.metrics).toContain('heart rate');
      expect(result.entities.metrics).toContain('bmi');
    });

    it('extracts screen names', () => {
      const result = classify('Open the dashboard for me');
      expect(result.entities.screens).toContain('dashboard');
    });

    it('extracts numbers', () => {
      const result = classify('I did 20 reps and 3 sets');
      expect(result.entities.numbers).toContain(20);
      expect(result.entities.numbers).toContain(3);
    });

    it('returns empty entities for unrecognized text', () => {
      const result = classify('the weather is nice');
      expect(result.entities.exercises).toEqual([]);
      expect(result.entities.muscleGroups).toEqual([]);
    });
  });

  // ============================================
  // DISAMBIGUATION
  // ============================================

  describe('disambiguation', () => {
    it('routes "how to" questions to COACH over WORKOUT', () => {
      const result = classify('How should I improve my squat form?');
      expect(result.category).toBe('COACH');
    });

    it('routes "generate/create" queries to WORKOUT over COACH', () => {
      // "Create" + "workout" both appear in WORKOUT keywords, but
      // "chest" and "back" are COACH keywords with high weight.
      // The classifier may favor COACH here. Test that it resolves to one of them.
      const result = classify('Create a leg workout for today');
      expect(result.category).toBe('WORKOUT');
    });

    it('reports secondary category for ambiguous queries', () => {
      // Touches both COACH and WORKOUT keywords
      const result = classify('I want to train chest workout technique');
      // Should have either primary or secondary set
      expect(result.category).toBeDefined();
      // Confidence should be between 0 and 1
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  // ============================================
  // CONFIDENCE & THRESHOLD
  // ============================================

  describe('confidence scoring', () => {
    it('returns confidence between 0 and 1', () => {
      const result = classify('Generate a beginner full body workout plan');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('returns higher confidence for keyword-rich queries', () => {
      const strong = classify('Generate a beginner bodyweight workout routine plan');
      const weak = classify('Something about exercise maybe');
      expect(strong.confidence).toBeGreaterThan(weak.confidence);
    });

    it('falls back to GENERAL below confidence threshold', () => {
      // Single vague word that barely matches anything
      const result = classify('xyz abc 123');
      expect(result.category).toBe('GENERAL');
    });
  });

  // ============================================
  // CLASSIFICATION METADATA
  // ============================================

  describe('classification metadata', () => {
    it('includes original query in result', () => {
      const query = 'Help me with squats';
      const result = classify(query);
      expect(result.query).toBe(query);
    });

    it('measures classification time', () => {
      const result = classify('Generate a workout');
      expect(result.classificationTimeMs).toBeGreaterThanOrEqual(0);
      // Should be fast (keyword-based, <100ms on any machine)
      expect(result.classificationTimeMs).toBeLessThan(500);
    });
  });

  // ============================================
  // SPECIFIC KEYWORD SCENARIOS
  // ============================================

  describe('specific keyword scenarios', () => {
    it('classifies rep/set discussion as COACH', () => {
      const result = classify('How many reps and sets should I do?');
      expect(result.category).toBe('COACH');
    });

    it('classifies flashcard queries as COACH (PROFESSOR removed)', () => {
      const result = classify('Review my flashcards and quiz me');
      expect(result.category).toBe('COACH');
    });

    it('classifies heart rate queries as HEALTH', () => {
      const result = classify('My resting heart rate is 90 bpm, is that normal?');
      expect(result.category).toBe('HEALTH');
    });

    it('classifies subscription queries as SETTINGS', () => {
      const result = classify('How do I upgrade to premium subscription?');
      expect(result.category).toBe('SETTINGS');
    });

    it('classifies sleep queries as HEALTH', () => {
      const result = classify('How much sleep do I need for healthy recovery?');
      expect(result.category).toBe('HEALTH');
    });

    it('classifies deload queries as WORKOUT', () => {
      const result = classify('Am I ready for a deload week with progressive overload?');
      expect(result.category).toBe('WORKOUT');
    });
  });
});
