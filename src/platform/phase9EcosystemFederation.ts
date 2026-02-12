export type IntegrationTier = 'COMMUNITY' | 'CERTIFIED' | 'ENTERPRISE';

export interface IntegrationDescriptor {
  id: string;
  name: string;
  provider: string;
  tier: IntegrationTier;
  scopes: string[];
}

export interface FederationPolicy {
  allowExport: boolean;
  allowImport: boolean;
  requiredScopes: string[];
}

export function canActivateIntegration(
  integration: IntegrationDescriptor,
  policy: FederationPolicy
): { allowed: boolean; reason: string } {
  if (!policy.allowImport && !policy.allowExport) {
    return { allowed: false, reason: 'Federation policy disallows both import and export.' };
  }

  const missing = policy.requiredScopes.filter((scope) => !integration.scopes.includes(scope));
  if (missing.length > 0) {
    return {
      allowed: false,
      reason: `Integration missing required scopes: ${missing.join(', ')}`,
    };
  }

  return { allowed: true, reason: 'Integration satisfies federation policy.' };
}

export function buildDefaultFederationPolicy(): FederationPolicy {
  return {
    allowExport: true,
    allowImport: true,
    requiredScopes: ['read:workouts', 'write:progress'],
  };
}
