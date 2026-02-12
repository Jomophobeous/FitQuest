export interface SloTarget {
  metric: 'availability' | 'p95_latency_ms' | 'error_rate';
  target: number;
}

export interface ComplianceControl {
  id: string;
  name: string;
  owner: string;
  automated: boolean;
}

export interface HardeningSnapshot {
  version: string;
  sloTargets: SloTarget[];
  controls: ComplianceControl[];
  riskScore: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeRiskScore(
  controlsCoveragePercent: number,
  incidentCount30d: number,
  slaBreaches30d: number
): number {
  const controlsPenalty = 100 - clamp(controlsCoveragePercent, 0, 100);
  const incidentPenalty = clamp(incidentCount30d * 7, 0, 100);
  const breachPenalty = clamp(slaBreaches30d * 12, 0, 100);
  const score = controlsPenalty * 0.5 + incidentPenalty * 0.3 + breachPenalty * 0.2;
  return Math.round(clamp(score, 0, 100));
}

export function buildEnterpriseHardeningSnapshot(): HardeningSnapshot {
  return {
    version: 'phase10.foundation.v1',
    sloTargets: [
      { metric: 'availability', target: 99.9 },
      { metric: 'p95_latency_ms', target: 300 },
      { metric: 'error_rate', target: 0.5 },
    ],
    controls: [
      { id: 'ctrl_key_rotation', name: 'Key Rotation Enforcement', owner: 'Security', automated: true },
      { id: 'ctrl_backup_restore', name: 'Backup Restore Drill', owner: 'SRE', automated: false },
      { id: 'ctrl_privacy_audit', name: 'Privacy Audit Trail', owner: 'Compliance', automated: true },
    ],
    riskScore: computeRiskScore(78, 2, 1),
  };
}
