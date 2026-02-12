import { getAppState, setAppState } from '../database/service';
import {
  buildEnterpriseHardeningSnapshot,
  computeRiskScore,
  type HardeningSnapshot,
} from '../platform/phase10EnterpriseHardening';

const HARDENING_STATE_KEY = 'enterprise.hardening.state.v1';

export interface EnterpriseHardeningRuntime {
  controlsCoveragePercent: number;
  incidentCount30d: number;
  slaBreaches30d: number;
  snapshot: HardeningSnapshot;
  updatedAt: number;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function defaultRuntime(): EnterpriseHardeningRuntime {
  const snapshot = buildEnterpriseHardeningSnapshot();
  return {
    controlsCoveragePercent: 78,
    incidentCount30d: 2,
    slaBreaches30d: 1,
    snapshot,
    updatedAt: Date.now(),
  };
}

function buildRuntime(
  controlsCoveragePercent: number,
  incidentCount30d: number,
  slaBreaches30d: number
): EnterpriseHardeningRuntime {
  const baseline = buildEnterpriseHardeningSnapshot();
  return {
    controlsCoveragePercent,
    incidentCount30d,
    slaBreaches30d,
    snapshot: {
      ...baseline,
      riskScore: computeRiskScore(controlsCoveragePercent, incidentCount30d, slaBreaches30d),
    },
    updatedAt: Date.now(),
  };
}

export async function getEnterpriseHardeningRuntime(): Promise<EnterpriseHardeningRuntime> {
  const existing = parseJson<EnterpriseHardeningRuntime | null>(await getAppState(HARDENING_STATE_KEY), null);
  if (existing) return existing;

  const runtime = defaultRuntime();
  await setAppState(HARDENING_STATE_KEY, JSON.stringify(runtime));
  return runtime;
}

export async function updateEnterpriseHardeningRuntime(patch: {
  controlsCoveragePercent?: number;
  incidentCount30d?: number;
  slaBreaches30d?: number;
}): Promise<EnterpriseHardeningRuntime> {
  const current = await getEnterpriseHardeningRuntime();
  const next = buildRuntime(
    patch.controlsCoveragePercent !== undefined
      ? normalizePercent(patch.controlsCoveragePercent)
      : current.controlsCoveragePercent,
    patch.incidentCount30d !== undefined
      ? normalizeCount(patch.incidentCount30d)
      : current.incidentCount30d,
    patch.slaBreaches30d !== undefined
      ? normalizeCount(patch.slaBreaches30d)
      : current.slaBreaches30d
  );

  await setAppState(HARDENING_STATE_KEY, JSON.stringify(next));
  return next;
}
