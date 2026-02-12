export type SafetyMode = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';

export interface AutomationPolicy {
  policyId: string;
  name: string;
  safetyMode: SafetyMode;
  maxDailyAdjustments: number;
  requiresHumanReview: boolean;
}

export interface AutomationDecision {
  policyId: string;
  action: 'INCREASE_LOAD' | 'DECREASE_LOAD' | 'HOLD';
  confidence: number;
  rationale: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function scoreAutomationConfidence(signalStrength: number, dataQuality: number): number {
  const score = signalStrength * 0.6 + dataQuality * 0.4;
  return Number(clamp(score, 0, 1).toFixed(2));
}

export function decideAutomationAction(
  policy: AutomationPolicy,
  readinessScore: number,
  strainScore: number
): AutomationDecision {
  const boundedReadiness = clamp(readinessScore, 0, 100);
  const boundedStrain = clamp(strainScore, 0, 100);
  const confidence = scoreAutomationConfidence(boundedReadiness / 100, 1 - boundedStrain / 100);

  if (boundedStrain >= 75) {
    return {
      policyId: policy.policyId,
      action: 'DECREASE_LOAD',
      confidence,
      rationale: 'High strain threshold reached. Recovery-first adaptation selected.',
    };
  }

  if (boundedReadiness >= 70 && boundedStrain <= 40) {
    return {
      policyId: policy.policyId,
      action: 'INCREASE_LOAD',
      confidence,
      rationale: 'Readiness is high with manageable strain. Progressive overload approved.',
    };
  }

  return {
    policyId: policy.policyId,
    action: 'HOLD',
    confidence,
    rationale: 'Signals are mixed. Workload is held stable until clearer trends emerge.',
  };
}
