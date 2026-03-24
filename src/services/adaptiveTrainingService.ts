import { getAppState, setAppState } from '../database/service';
import { clamp, deriveAdaptiveTrainingProfile, getDefaultAdaptiveTrainingProfile } from './adaptiveTrainingMath';
import type { AdaptiveSessionInput, AdaptiveTrainingProfile } from './adaptiveTrainingMath';

export type { AdaptiveSessionInput, AdaptiveTrainingProfile } from './adaptiveTrainingMath';

const ADAPTIVE_PROFILE_VERSION = 'v1';

function profileKey(userId: string): string {
  return `${userId}_adaptive_profile_${ADAPTIVE_PROFILE_VERSION}`;
}

function parseProfile(raw: string | null, userId: string): AdaptiveTrainingProfile {
  if (!raw) {
    return getDefaultAdaptiveTrainingProfile(userId);
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AdaptiveTrainingProfile>;
    return {
      userId,
      fatigueSensitivity: clamp(Number(parsed.fatigueSensitivity) || 1, 0.8, 1.25),
      progressionAggressiveness: clamp(Number(parsed.progressionAggressiveness) || 1, 0.8, 1.25),
      volumeTolerance: clamp(Number(parsed.volumeTolerance) || 1, 0.8, 1.2),
      confidence: clamp(Number(parsed.confidence) || 0, 0, 1),
      samples: Math.max(0, Math.floor(Number(parsed.samples) || 0)),
      updatedAt: Number(parsed.updatedAt) || 0,
      rationale: Array.isArray(parsed.rationale)
        ? parsed.rationale.filter((entry) => typeof entry === 'string')
        : getDefaultAdaptiveTrainingProfile(userId).rationale,
    };
  } catch {
    return getDefaultAdaptiveTrainingProfile(userId);
  }
}

export async function getAdaptiveTrainingProfile(userId: string): Promise<AdaptiveTrainingProfile> {
  const raw = await getAppState(profileKey(userId));
  return parseProfile(raw, userId);
}

export async function updateAdaptiveTrainingProfileFromSession(
  userId: string,
  input: AdaptiveSessionInput,
): Promise<AdaptiveTrainingProfile> {
  const current = await getAdaptiveTrainingProfile(userId);
  const next = deriveAdaptiveTrainingProfile(current, input, Date.now());

  await setAppState(profileKey(userId), JSON.stringify(next));
  return next;
}
