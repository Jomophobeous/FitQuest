import { describe, expect, it } from 'vitest';

import {
  buildDefaultPlatformTemplates,
  createWorkspace,
  validateTemplateDefinition,
} from '../src/platform/phase7Platformization';
import {
  decideAutomationAction,
  type AutomationPolicy,
} from '../src/platform/phase8AutonomousOperations';
import {
  buildDefaultFederationPolicy,
  canActivateIntegration,
} from '../src/platform/phase9EcosystemFederation';
import {
  buildEnterpriseHardeningSnapshot,
  computeRiskScore,
} from '../src/platform/phase10EnterpriseHardening';

describe('phase 7 platformization foundations', () => {
  it('builds valid default templates', () => {
    const templates = buildDefaultPlatformTemplates();
    expect(templates.length).toBeGreaterThan(0);
    for (const template of templates) {
      expect(validateTemplateDefinition(template)).toEqual([]);
    }
  });

  it('creates workspace with owner and template links', () => {
    const workspace = createWorkspace('coach_001', ['tpl_strength_foundation']);
    expect(workspace.ownerId).toBe('coach_001');
    expect(workspace.templateIds).toContain('tpl_strength_foundation');
    expect(workspace.published).toBe(false);
  });
});

describe('phase 8 autonomous operations foundations', () => {
  const policy: AutomationPolicy = {
    policyId: 'policy_default',
    name: 'Default policy',
    safetyMode: 'BALANCED',
    maxDailyAdjustments: 2,
    requiresHumanReview: false,
  };

  it('decreases load on high strain', () => {
    const decision = decideAutomationAction(policy, 65, 80);
    expect(decision.action).toBe('DECREASE_LOAD');
  });

  it('increases load on high readiness and low strain', () => {
    const decision = decideAutomationAction(policy, 84, 30);
    expect(decision.action).toBe('INCREASE_LOAD');
  });
});

describe('phase 9 ecosystem federation foundations', () => {
  it('permits integration when required scopes are present', () => {
    const policy = buildDefaultFederationPolicy();
    const verdict = canActivateIntegration(
      {
        id: 'int_example',
        name: 'Example',
        provider: 'Example Provider',
        tier: 'CERTIFIED',
        scopes: ['read:workouts', 'write:progress'],
      },
      policy
    );

    expect(verdict.allowed).toBe(true);
  });
});

describe('phase 10 enterprise hardening foundations', () => {
  it('computes bounded risk score and snapshot', () => {
    const riskScore = computeRiskScore(80, 2, 1);
    expect(riskScore).toBeGreaterThanOrEqual(0);
    expect(riskScore).toBeLessThanOrEqual(100);

    const snapshot = buildEnterpriseHardeningSnapshot();
    expect(snapshot.sloTargets.length).toBeGreaterThan(0);
    expect(snapshot.controls.length).toBeGreaterThan(0);
  });
});
