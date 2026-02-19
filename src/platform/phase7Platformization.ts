export type PlatformCapability =
  | 'COACH_TOOLING'
  | 'PROGRAM_BUILDER'
  | 'SDK_EXPORT'
  | 'TEMPLATE_MARKETPLACE';

export interface ProgramTemplateDefinition {
  id: string;
  title: string;
  goal: string;
  daysPerWeek: number;
  capabilities: PlatformCapability[];
}

export interface BuilderWorkspace {
  workspaceId: string;
  ownerId: string;
  templateIds: string[];
  published: boolean;
}

export function isValidDaysPerWeek(daysPerWeek: number): boolean {
  return Number.isInteger(daysPerWeek) && daysPerWeek >= 1 && daysPerWeek <= 7;
}

export function validateTemplateDefinition(definition: ProgramTemplateDefinition): string[] {
  const errors: string[] = [];
  if (!definition.id.trim()) errors.push('Template id is required.');
  if (!definition.title.trim()) errors.push('Template title is required.');
  if (!definition.goal.trim()) errors.push('Template goal is required.');
  if (!isValidDaysPerWeek(definition.daysPerWeek)) {
    errors.push('Template daysPerWeek must be between 1 and 7.');
  }
  if (!Array.isArray(definition.capabilities) || definition.capabilities.length === 0) {
    errors.push('Template must include at least one capability.');
  }
  return errors;
}

export function buildDefaultPlatformTemplates(): ProgramTemplateDefinition[] {
  return [
    {
      id: 'tpl_strength_foundation',
      title: 'Strength Foundation',
      goal: 'strength',
      daysPerWeek: 4,
      capabilities: ['COACH_TOOLING', 'PROGRAM_BUILDER'],
    },
    {
      id: 'tpl_mobility_performance',
      title: 'Mobility Performance',
      goal: 'mobility',
      daysPerWeek: 3,
      capabilities: ['PROGRAM_BUILDER', 'SDK_EXPORT'],
    },
  ];
}

export function createWorkspace(ownerId: string, templateIds: string[]): BuilderWorkspace {
  const workspaceId = `wk_${Date.now()}_${ownerId.slice(0, 6)}`;
  return {
    workspaceId,
    ownerId,
    templateIds,
    published: false,
  };
}
