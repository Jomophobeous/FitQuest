import { getAppState, setAppState } from '../database/service';
import {
  decideAutomationAction,
  type AutomationDecision,
  type AutomationPolicy,
  type SafetyMode,
} from '../platform/phase8AutonomousOperations';

const POLICY_KEY_PREFIX = 'autonomous.policy.v1.';
const DECISION_LOG_KEY_PREFIX = 'autonomous.policy.decisions.v1.';

export interface PolicyDecisionRecord {
  id: string;
  createdAt: number;
  readinessScore: number;
  strainScore: number;
  decision: AutomationDecision;
}

function policyKey(userId: string): string {
  return `${POLICY_KEY_PREFIX}${userId}`;
}

function decisionKey(userId: string): string {
  return `${DECISION_LOG_KEY_PREFIX}${userId}`;
}

function parseJsonObject<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function parseJsonArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function defaultPolicy(): AutomationPolicy {
  return {
    policyId: 'policy_default_balanced',
    name: 'Balanced Progression Policy',
    safetyMode: 'BALANCED',
    maxDailyAdjustments: 2,
    requiresHumanReview: false,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scoreFromWorkout(completionRatio: number, averageDifficulty: number, isDeload: boolean): {
  readinessScore: number;
  strainScore: number;
} {
  const completion = clamp(completionRatio, 0, 1);
  const difficulty = clamp(averageDifficulty, 1, 10);

  const readinessBase = completion * 100;
  const readinessDifficultyPenalty = (difficulty - 5) * 6;
  const readinessDeloadPenalty = isDeload ? 12 : 0;

  const strainBase = difficulty * 10;
  const strainCompletionPenalty = (1 - completion) * 30;
  const strainDeloadPenalty = isDeload ? -8 : 0;

  return {
    readinessScore: Math.round(clamp(readinessBase - readinessDifficultyPenalty - readinessDeloadPenalty, 0, 100)),
    strainScore: Math.round(clamp(strainBase + strainCompletionPenalty + strainDeloadPenalty, 0, 100)),
  };
}

function withSafetyPolicy(
  policy: AutomationPolicy,
  decision: AutomationDecision,
  strainScore: number
): AutomationDecision {
  if (policy.safetyMode === 'CONSERVATIVE' && decision.action === 'INCREASE_LOAD') {
    return {
      ...decision,
      action: 'HOLD',
      rationale: 'Conservative safety mode blocked load increase.',
    };
  }

  if (policy.requiresHumanReview && strainScore >= 60 && decision.action !== 'DECREASE_LOAD') {
    return {
      ...decision,
      action: 'HOLD',
      rationale: 'Human review required for medium/high strain profile.',
    };
  }

  return decision;
}

export async function getAutomationPolicy(userId: string): Promise<AutomationPolicy> {
  const existing = parseJsonObject<AutomationPolicy>(await getAppState(policyKey(userId)));
  if (existing) return existing;

  const policy = defaultPolicy();
  await setAppState(policyKey(userId), JSON.stringify(policy));
  return policy;
}

export async function updateAutomationPolicy(
  userId: string,
  patch: Partial<Pick<AutomationPolicy, 'name' | 'safetyMode' | 'maxDailyAdjustments' | 'requiresHumanReview'>>
): Promise<AutomationPolicy> {
  const current = await getAutomationPolicy(userId);
  const next: AutomationPolicy = {
    ...current,
    ...patch,
    safetyMode: (patch.safetyMode as SafetyMode | undefined) ?? current.safetyMode,
  };

  await setAppState(policyKey(userId), JSON.stringify(next));
  return next;
}

export async function listAutomationDecisions(userId: string, limit = 20): Promise<PolicyDecisionRecord[]> {
  const rows = parseJsonArray<PolicyDecisionRecord>(await getAppState(decisionKey(userId)));
  return rows.slice(0, limit);
}

export async function evaluatePostWorkoutPolicyDecision(
  userId: string,
  input: {
    completionRatio: number;
    averageDifficulty: number;
    isDeload: boolean;
  }
): Promise<PolicyDecisionRecord> {
  const policy = await getAutomationPolicy(userId);
  const { readinessScore, strainScore } = scoreFromWorkout(
    input.completionRatio,
    input.averageDifficulty,
    input.isDeload
  );

  const baseDecision = decideAutomationAction(policy, readinessScore, strainScore);
  const finalDecision = withSafetyPolicy(policy, baseDecision, strainScore);

  const record: PolicyDecisionRecord = {
    id: `pd_${Date.now()}`,
    createdAt: Date.now(),
    readinessScore,
    strainScore,
    decision: finalDecision,
  };

  const existing = parseJsonArray<PolicyDecisionRecord>(await getAppState(decisionKey(userId)));
  const next = [record, ...existing].slice(0, 50);
  await setAppState(decisionKey(userId), JSON.stringify(next));

  return record;
}
