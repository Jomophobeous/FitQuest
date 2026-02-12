import { getAppState, setAppState } from '../database/service';
import {
  buildDefaultFederationPolicy,
  canActivateIntegration,
  type FederationPolicy,
  type IntegrationDescriptor,
} from '../platform/phase9EcosystemFederation';

const POLICY_KEY = 'federation.policy.v1';
const REGISTRY_KEY = 'federation.registry.v1';

export interface IntegrationRuntimeRecord {
  integration: IntegrationDescriptor;
  active: boolean;
  lastCheckedAt: number;
  statusReason: string;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function getFederationPolicyRuntime(): Promise<FederationPolicy> {
  const existing = parseJson<FederationPolicy | null>(await getAppState(POLICY_KEY), null);
  if (existing) return existing;

  const policy = buildDefaultFederationPolicy();
  await setAppState(POLICY_KEY, JSON.stringify(policy));
  return policy;
}

export async function updateFederationPolicyRuntime(
  patch: Partial<FederationPolicy>
): Promise<FederationPolicy> {
  const current = await getFederationPolicyRuntime();
  const next: FederationPolicy = {
    ...current,
    ...patch,
    requiredScopes: patch.requiredScopes ?? current.requiredScopes,
  };
  await setAppState(POLICY_KEY, JSON.stringify(next));
  return next;
}

export async function listFederationIntegrations(): Promise<IntegrationRuntimeRecord[]> {
  return parseJson<IntegrationRuntimeRecord[]>(await getAppState(REGISTRY_KEY), []);
}

export async function registerFederationIntegration(
  integration: IntegrationDescriptor
): Promise<IntegrationRuntimeRecord> {
  const policy = await getFederationPolicyRuntime();
  const verdict = canActivateIntegration(integration, policy);

  const record: IntegrationRuntimeRecord = {
    integration,
    active: verdict.allowed,
    lastCheckedAt: Date.now(),
    statusReason: verdict.reason,
  };

  const existing = await listFederationIntegrations();
  const filtered = existing.filter((item) => item.integration.id !== integration.id);
  const next = [record, ...filtered].slice(0, 50);
  await setAppState(REGISTRY_KEY, JSON.stringify(next));
  return record;
}

export async function revalidateFederationRegistry(): Promise<IntegrationRuntimeRecord[]> {
  const policy = await getFederationPolicyRuntime();
  const existing = await listFederationIntegrations();

  const next = existing.map((item) => {
    const verdict = canActivateIntegration(item.integration, policy);
    return {
      ...item,
      active: verdict.allowed,
      statusReason: verdict.reason,
      lastCheckedAt: Date.now(),
    };
  });

  await setAppState(REGISTRY_KEY, JSON.stringify(next));
  return next;
}
