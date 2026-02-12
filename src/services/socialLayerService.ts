import { getAppState, setAppState } from '../database/service';

const SOCIAL_SETTINGS_KEY_PREFIX = 'social_layer.settings.';

export interface SocialLayerSettings {
  enabled: boolean;
  leaderboardOptIn: boolean;
  asyncChallengesOptIn: boolean;
  guildDiscoveryOptIn: boolean;
  updatedAt: number;
}

function defaultSettings(): SocialLayerSettings {
  return {
    enabled: false,
    leaderboardOptIn: false,
    asyncChallengesOptIn: false,
    guildDiscoveryOptIn: false,
    updatedAt: Date.now(),
  };
}

function keyForUser(userId: string): string {
  return `${SOCIAL_SETTINGS_KEY_PREFIX}${userId}`;
}

function normalizeSettings(raw: unknown): SocialLayerSettings {
  const fallback = defaultSettings();
  if (!raw || typeof raw !== 'object') return fallback;

  const data = raw as Partial<SocialLayerSettings>;
  const enabled = Boolean(data.enabled);

  return {
    enabled,
    leaderboardOptIn: enabled ? Boolean(data.leaderboardOptIn) : false,
    asyncChallengesOptIn: enabled ? Boolean(data.asyncChallengesOptIn) : false,
    guildDiscoveryOptIn: enabled ? Boolean(data.guildDiscoveryOptIn) : false,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
  };
}

export async function getSocialLayerSettings(userId: string): Promise<SocialLayerSettings> {
  const raw = await getAppState(keyForUser(userId));
  if (!raw) return defaultSettings();

  try {
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return defaultSettings();
  }
}

export async function setSocialLayerEnabled(userId: string, enabled: boolean): Promise<SocialLayerSettings> {
  const current = await getSocialLayerSettings(userId);
  const next: SocialLayerSettings = {
    ...current,
    enabled,
    leaderboardOptIn: enabled ? current.leaderboardOptIn : false,
    asyncChallengesOptIn: enabled ? current.asyncChallengesOptIn : false,
    guildDiscoveryOptIn: enabled ? current.guildDiscoveryOptIn : false,
    updatedAt: Date.now(),
  };

  await setAppState(keyForUser(userId), JSON.stringify(next));
  return next;
}
