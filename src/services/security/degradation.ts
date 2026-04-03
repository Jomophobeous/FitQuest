/**
 * FitQuest Degradation Engine — Phase 17 (Confidence-Weighted Dynamic Ceilings)
 *
 * Persistent, escalating, unpredictable degradation with camouflaged failure injection.
 *
 * Phase 13: Day-aware escalation, controlled entropy, non-deterministic delays.
 * Phase 14: Silent failure injection, sentinel integration.
 * Phase 15:
 *   MOVE 4 — Degradation camouflage: make corruption indistinguishable from
 *            natural AI imperfection (semantic drift, network-like delay variance,
 *            plausible formatting differences).
 *   MOVE 5 — False recovery loop integration: degradation respects cooling phase.
 *   MOVE 6 — Hard caps on all degradation metrics (usability floor).
 * Phase 16:
 *   ALL degradation gated behind verificationConfidence >= 'medium' AND stabilityWindow.
 *   Offline users (confidence='low') experience ZERO degradation.
 *   Degradation only applies after score persists at threshold for 2+ minutes.
 * Phase 17:
 *   Confidence-weighted dynamic ceilings. MEDIUM confidence gets tighter caps
 *   than HIGH confidence (less aggressive when only partially verified).
 *   Sentinel anomaly gating considers network reliability from device context.
 *
 * Degradation tiers:
 *   LOW:    no degradation
 *   MEDIUM: AI delay 300–800ms, 15% fallback, varies by day
 *   HIGH:   AI delay 1–2.5s (capped), 40–65% fallback (capped), premium reduction,
 *           camouflaged failure injection on AI responses
 */

import { tamperEngine, type RiskLevel } from './tamperEngine';
import { sentinelGetAnomalyScore, sentinelShouldDegrade } from './sentinel';

// ============================================
// CONSTANTS (base values — escalated by degradationDay)
// ============================================

const MEDIUM_DELAY_MIN = 300;
const MEDIUM_DELAY_MAX = 800;
const HIGH_DELAY_MIN = 1000;
const HIGH_DELAY_MAX = 2000;
const DELAY_ESCALATION_PER_DAY = 150;

const MEDIUM_FALLBACK_BASE = 0.15;
const HIGH_FALLBACK_BASE = 0.4;
const FALLBACK_ESCALATION_PER_DAY = 0.025;

const HIGH_PREMIUM_REDUCTION_BASE = 0.3;
const PREMIUM_ESCALATION_PER_DAY = 0.03;

// Phase 14: Silent failure injection probability at HIGH risk
const FAILURE_INJECTION_BASE = 0.2; // 20% chance per response at HIGH
const FAILURE_INJECTION_ESCALATION = 0.03; // +3% per degradation day

// Phase 15: Hard ceilings (MOVE 6) — app must remain usable
const CEILING_DELAY_MS = 2500; // Max AI delay 2.5s
const CEILING_FAILURE_RATE = 0.65; // Max failure injection probability
const CEILING_FALLBACK_RATE = 0.65; // Max fallback probability
const CEILING_PREMIUM_REDUCTION = 0.6; // Max premium feature reduction

// Phase 17: Confidence-weighted ceiling multipliers
// MEDIUM confidence gets tighter caps (less aggressive when partially verified)
const MEDIUM_CONFIDENCE_CEILING_FACTOR = 0.6; // 60% of full ceiling at MEDIUM

const FALLBACK_RESPONSES = [
  "I'm processing your request. Could you try rephrasing that?",
  'Let me think about that differently. Can you be more specific?',
  'I want to give you the best answer. Could you add more detail?',
  "That's an interesting question. Let me consider a few angles.",
  "I'm working on a thorough response. Try asking in a slightly different way.",
  'Great question! Let me gather my thoughts on this one.',
  "I'd like to help with that. Can you provide a bit more context?",
  'Hmm, let me process that. Could you elaborate on what you mean?',
];

// Phase 14: Filler phrases injected into responses (look like natural AI quirks)
const FILLER_SUFFIXES = [
  "\n\nLet me know if you'd like me to go deeper on any of these points.",
  '\n\nI hope that helps! Feel free to ask follow-up questions.',
  "\n\nThere's a lot more to explore here — just let me know.",
  '\n\nRemember, consistency is key in any fitness journey.',
];

// Phase 15: Camouflage patterns (MOVE 4) — mimic natural AI imperfection
// Semantic drift: slightly off but plausible phrasing changes
const SEMANTIC_DRIFT_PAIRS: [RegExp, string][] = [
  [/\bsets\b/gi, 'rounds'],
  [/\breps\b/gi, 'repetitions'],
  [/\brest\b/gi, 'pause'],
  [/\bexercise\b/gi, 'movement'],
  [/\bworkout\b/gi, 'training session'],
  [/\bmuscle\b/gi, 'muscle group'],
  [/\bcalories\b/gi, 'energy expenditure'],
];

// Network-like delay variance — makes delays look like real network latency
const NETWORK_JITTER_PATTERNS = [
  // Simulate DNS lookup + SSL + response
  { min: 180, max: 350, label: 'fast' },
  { min: 400, max: 700, label: 'normal' },
  { min: 800, max: 1200, label: 'slow' },
  { min: 1500, max: 2500, label: 'congested' },
];

// ============================================
// DEGRADATION ENGINE
// ============================================

class DegradationEngine {
  /**
   * Phase 17: Get ceiling value scaled by current verification confidence.
   * MEDIUM confidence → tighter ceiling (60% of max).
   * HIGH confidence → full ceiling.
   * LOW confidence → irrelevant (effectiveRisk returns 'low').
   */
  private scaledCeiling(baseCeiling: number): number {
    const confidence = tamperEngine.getVerificationConfidence();
    if (confidence === 'medium') {
      return baseCeiling * MEDIUM_CONFIDENCE_CEILING_FACTOR;
    }
    return baseCeiling;
  }

  /**
   * Apply artificial delay before returning an AI response.
   * Phase 15: Uses network-simulation jitter patterns for camouflage.
   * Ceiling-capped per MOVE 6.
   */
  async applyAIDelay(riskOverride?: RiskLevel): Promise<void> {
    const level = this.effectiveRisk(riskOverride);
    if (level === 'low') return;

    // Phase 15: Select delay pattern that simulates real network conditions
    let delay: number;
    if (level === 'medium') {
      // Medium uses fast/normal patterns
      const pattern = this.entropy() < 0.6 ? NETWORK_JITTER_PATTERNS[0]! : NETWORK_JITTER_PATTERNS[1]!;
      delay = this.randomRange(pattern.min, pattern.max);
    } else {
      // High uses slow/congested patterns, escalated by day
      const day = tamperEngine.getDegradationDay();
      const patternIdx = day >= 3 ? 3 : 2;
      const pattern = NETWORK_JITTER_PATTERNS[patternIdx]!;
      delay = this.randomRange(
        pattern.min + day * (DELAY_ESCALATION_PER_DAY / 2),
        pattern.max + day * DELAY_ESCALATION_PER_DAY,
      );
    }

    // Phase 15 MOVE 6: Hard ceiling — Phase 17: scaled by confidence
    delay = Math.min(delay, this.scaledCeiling(CEILING_DELAY_MS));

    // Natural jitter: ±15% variance (simulates real network fluctuation)
    const jitter = 1.0 + (this.entropy() - 0.5) * 0.3;
    const finalDelay = Math.max(0, Math.round(delay * jitter));

    if (finalDelay > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, finalDelay)); // backoff-delay
    }
  }

  /**
   * Whether AI responses should be downgraded to fallback.
   * Day-aware + sentinel-aware. Ceiling-capped (MOVE 6).
   */
  shouldDowngradeAI(riskOverride?: RiskLevel): boolean {
    const level = this.effectiveRisk(riskOverride);
    if (level === 'low') return false;

    const day = tamperEngine.getDegradationDay();

    let probability: number;
    if (level === 'high') {
      // Phase 17: scaled ceiling
      probability = Math.min(
        HIGH_FALLBACK_BASE + day * FALLBACK_ESCALATION_PER_DAY,
        this.scaledCeiling(CEILING_FALLBACK_RATE),
      );
    } else {
      probability = MEDIUM_FALLBACK_BASE;
    }

    return this.entropy() < probability;
  }

  getFallbackResponse(): string {
    const idx = Math.floor(this.entropy() * FALLBACK_RESPONSES.length);
    return FALLBACK_RESPONSES[idx] ?? FALLBACK_RESPONSES[0]!;
  }

  /**
   * Whether a premium feature should be silently reduced.
   * Only at HIGH risk. Escalates with degradation day. Ceiling-capped (MOVE 6).
   */
  shouldReducePremiumFeature(): boolean {
    const level = this.effectiveRisk();
    if (level !== 'high') return false;

    const day = tamperEngine.getDegradationDay();
    // Phase 17: scaled ceiling
    const probability = Math.min(
      HIGH_PREMIUM_REDUCTION_BASE + day * PREMIUM_ESCALATION_PER_DAY,
      this.scaledCeiling(CEILING_PREMIUM_REDUCTION),
    );
    return this.entropy() < probability;
  }

  /**
   * Phase 15 — MOVE 4: Camouflaged failure injection.
   *
   * At HIGH risk, degrade AI response quality in ways indistinguishable
   * from natural AI imperfection. User thinks "AI is having an off day",
   * not "system is sabotaging me".
   *
   * Strategies:
   *   1. Semantic drift — swap domain terms for plausible synonyms
   *   2. Soft truncation — end at natural sentence boundary, shorter than expected
   *   3. Formatting inconsistency — mix list styles, remove some structure
   *   4. Filler injection — add generic closing that dilutes quality
   *
   * Ceiling-capped per MOVE 6. Returns the (possibly degraded) response.
   */
  injectSubtleFailure(response: string): string {
    const level = this.effectiveRisk();
    if (level !== 'high') return response;

    const day = tamperEngine.getDegradationDay();
    // Phase 17: scaled ceiling
    const probability = Math.min(
      FAILURE_INJECTION_BASE + day * FAILURE_INJECTION_ESCALATION,
      this.scaledCeiling(CEILING_FAILURE_RATE),
    );

    if (this.entropy() >= probability) return response; // No injection this time

    // Pick a camouflage strategy based on entropy distribution
    const strategy = this.entropy();

    if (strategy < 0.3 && response.length > 300) {
      // Strategy 1: Semantic drift — swap 1-2 domain terms for synonyms
      let drifted = response;
      const driftCount = this.entropy() < 0.5 ? 1 : 2;
      const shuffled = [...SEMANTIC_DRIFT_PAIRS].sort(() => this.entropy() - 0.5);
      let applied = 0;
      for (const [pattern, replacement] of shuffled) {
        if (applied >= driftCount) break;
        if (pattern.test(drifted)) {
          drifted = drifted.replace(pattern, replacement);
          applied++;
        }
      }
      return applied > 0 ? drifted : response;
    }

    if (strategy < 0.55 && response.length > 200) {
      // Strategy 2: Soft truncation — end at a natural sentence boundary
      // Cut at ~60-75% (less aggressive than Phase 14)
      const targetLength = Math.floor(response.length * (0.6 + this.entropy() * 0.15));
      const truncated = response.slice(0, targetLength).trimEnd();
      const boundaries = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
      let bestEnd = -1;
      for (const boundary of boundaries) {
        const idx = truncated.lastIndexOf(boundary);
        if (idx > bestEnd) bestEnd = idx;
      }
      if (bestEnd > targetLength * 0.4) {
        return truncated.slice(0, bestEnd + 1);
      }
      return truncated + '.';
    }

    if (strategy < 0.75) {
      // Strategy 3: Formatting inconsistency — subtle structural changes
      return response
        .replace(/^\s*[-*]\s+/gm, (match) =>
          // Randomly convert some bullets to numbered or plain
          this.entropy() < 0.4 ? match : '• ',
        )
        .replace(/\*\*([^*]+)\*\*/g, (_, text: string) =>
          // Remove some bold formatting (not all)
          this.entropy() < 0.5 ? text : `**${text}**`,
        );
    }

    // Strategy 4: Filler injection — generic closing that dilutes
    const idx = Math.floor(this.entropy() * FILLER_SUFFIXES.length);
    return response + (FILLER_SUFFIXES[idx] ?? '');
  }

  getDelay(level?: RiskLevel): number {
    const l = level ?? this.effectiveRisk();
    const day = tamperEngine.getDegradationDay();

    let delay: number;
    switch (l) {
      case 'low':
        return 0;
      case 'medium':
        delay = this.randomRange(MEDIUM_DELAY_MIN, MEDIUM_DELAY_MAX);
        break;
      case 'high': {
        const escalation = day * DELAY_ESCALATION_PER_DAY;
        delay = this.randomRange(HIGH_DELAY_MIN + escalation, HIGH_DELAY_MAX + escalation);
        break;
      }
    }
    // Phase 15 MOVE 6: Hard ceiling — Phase 17: scaled by confidence
    return Math.min(delay, this.scaledCeiling(CEILING_DELAY_MS));
  }

  getRiskLevel(): RiskLevel {
    return this.effectiveRisk();
  }

  // ── Private Helpers ──

  /**
   * Phase 16: Effective risk — gated by verification confidence + stability window.
   *
   * Confidence gates:
   *   LOW  → always returns 'low' (no degradation for offline users)
   *   MEDIUM → allows up to 'medium' risk
   *   HIGH → allows full risk escalation (sentinel can bump to high)
   *
   * Stability gate: degradation only applies after score persists at threshold
   * for 2+ minutes (prevents transient spikes from causing degradation).
   */
  private effectiveRisk(override?: RiskLevel): RiskLevel {
    if (override) return override;

    const confidence = tamperEngine.getVerificationConfidence();

    // Phase 16: LOW confidence = verified offline → NO degradation
    if (confidence === 'low') return 'low';

    // Phase 16: Stability window must be satisfied before any degradation applies
    if (!tamperEngine.isStabilityWindowSatisfied()) return 'low';

    const engineLevel = tamperEngine.getRiskLevel();

    // If sentinel independently detects anomalies, escalate
    if (sentinelShouldDegrade()) {
      if (engineLevel === 'low') return 'medium';
      if (engineLevel === 'medium' && confidence === 'high') return 'high';
    }

    // Sentinel anomaly score can bump medium → high only at HIGH confidence
    const sentinelScore = sentinelGetAnomalyScore();
    if (engineLevel === 'medium' && sentinelScore >= 40 && confidence === 'high') return 'high';

    // Phase 16: MEDIUM confidence caps effective risk at 'medium'
    if (confidence === 'medium' && engineLevel === 'high') return 'medium';

    return engineLevel;
  }

  private entropy(): number {
    return tamperEngine.getEntropy();
  }

  private randomRange(min: number, max: number): number {
    return Math.floor(min + this.entropy() * (max - min));
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const degradation = new DegradationEngine();
