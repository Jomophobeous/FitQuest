/**
 * Social Layer Service Stub
 * Social features disabled in offline-only mode.
 */

export interface SocialLayerSettings {
  enabled: boolean;
  shareWorkouts: boolean;
  shareProgress: boolean;
}

export async function getSocialLayerSettings(_userId: string): Promise<SocialLayerSettings> {
  return { enabled: false, shareWorkouts: false, shareProgress: false };
}

export async function setSocialLayerEnabled(_userId: string, enabled: boolean): Promise<SocialLayerSettings> {
  return { enabled, shareWorkouts: false, shareProgress: false };
}
