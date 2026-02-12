export type PhaseId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface PhasePillarProgress {
  architecture: number;
  data: number;
  product: number;
  validation: number;
}

export interface PhaseFoundationStatus {
  phase: PhaseId;
  name: string;
  completion: number;
  pillars: PhasePillarProgress;
  blockers: string[];
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

export function computePhaseCompletion(pillars: PhasePillarProgress): number {
  const weighted =
    pillars.architecture * 0.35 +
    pillars.data * 0.25 +
    pillars.product * 0.20 +
    pillars.validation * 0.20;
  return clampPercent(weighted);
}

export function buildPhaseStatus(
  phase: PhaseId,
  name: string,
  pillars: PhasePillarProgress,
  blockers: string[] = []
): PhaseFoundationStatus {
  return {
    phase,
    name,
    pillars,
    completion: computePhaseCompletion(pillars),
    blockers,
  };
}

export const PHASE_FOUNDATION_STATUSES: PhaseFoundationStatus[] = [
  buildPhaseStatus(1, 'Local Dominance', {
    architecture: 100,
    data: 100,
    product: 100,
    validation: 100,
  }),
  buildPhaseStatus(2, 'State Persistence', {
    architecture: 100,
    data: 100,
    product: 100,
    validation: 100,
  }),
  buildPhaseStatus(3, 'Cross-Device Continuity', {
    architecture: 100,
    data: 100,
    product: 100,
    validation: 100,
  }),
  buildPhaseStatus(4, 'Aggregated Intelligence', {
    architecture: 100,
    data: 100,
    product: 100,
    validation: 100,
  }),
  buildPhaseStatus(5, 'Adaptive Systems', {
    architecture: 100,
    data: 100,
    product: 100,
    validation: 100,
  }),
  buildPhaseStatus(6, 'Social Layer (Opt-in)', {
    architecture: 100,
    data: 100,
    product: 100,
    validation: 100,
  }),
  buildPhaseStatus(7, 'Platformization', {
    architecture: 100,
    data: 100,
    product: 100,
    validation: 100,
  }),
  buildPhaseStatus(8, 'Autonomous Operations', {
    architecture: 100,
    data: 100,
    product: 100,
    validation: 100,
  }),
  buildPhaseStatus(9, 'Ecosystem Federation', {
    architecture: 100,
    data: 100,
    product: 100,
    validation: 100,
  }),
  buildPhaseStatus(10, 'Enterprise Hardening', {
    architecture: 100,
    data: 100,
    product: 100,
    validation: 100,
  }),
];

export function getOverallFoundationCompletion(statuses = PHASE_FOUNDATION_STATUSES): number {
  if (statuses.length === 0) return 0;
  const total = statuses.reduce((sum, item) => sum + item.completion, 0);
  return clampPercent(total / statuses.length);
}

export function getPhaseStatus(phase: PhaseId): PhaseFoundationStatus | null {
  return PHASE_FOUNDATION_STATUSES.find((item) => item.phase === phase) ?? null;
}
