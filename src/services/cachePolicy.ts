export type CacheDomain = 'meal' | 'profile' | 'workouts' | 'analytics' | 'sync';

export interface CachePolicy {
  ttlMs: number;
  persistent: boolean;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const POLICY_MAP: Record<CacheDomain, CachePolicy> = {
  meal: { ttlMs: 15 * MINUTE, persistent: true },
  profile: { ttlMs: 5 * MINUTE, persistent: true },
  workouts: { ttlMs: 3 * MINUTE, persistent: true },
  analytics: { ttlMs: 30 * MINUTE, persistent: true },
  sync: { ttlMs: 1 * HOUR, persistent: true },
};

export function getCachePolicy(domain: CacheDomain): CachePolicy {
  return POLICY_MAP[domain];
}
