import * as Crypto from 'expo-crypto';
import { getAppState, setAppState } from '../database/service';
import {
  buildDefaultPlatformTemplates,
  createWorkspace,
  type BuilderWorkspace,
  type ProgramTemplateDefinition,
  validateTemplateDefinition,
} from '../platform/phase7Platformization';

const TEMPLATE_KEY = 'platform_studio.templates.v1';
const WORKSPACE_KEY = 'platform_studio.workspaces.v1';

function parseJsonArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function saveTemplates(templates: ProgramTemplateDefinition[]): Promise<void> {
  await setAppState(TEMPLATE_KEY, JSON.stringify(templates));
}

async function saveWorkspaces(workspaces: BuilderWorkspace[]): Promise<void> {
  await setAppState(WORKSPACE_KEY, JSON.stringify(workspaces));
}

export async function getPlatformTemplates(): Promise<ProgramTemplateDefinition[]> {
  const existing = parseJsonArray<ProgramTemplateDefinition>(await getAppState(TEMPLATE_KEY));
  if (existing.length > 0) return existing;

  const defaults = buildDefaultPlatformTemplates();
  await saveTemplates(defaults);
  return defaults;
}

export async function addPlatformTemplate(
  template: Omit<ProgramTemplateDefinition, 'id'>
): Promise<ProgramTemplateDefinition> {
  const id = `tpl_${Crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const next: ProgramTemplateDefinition = {
    ...template,
    id,
  };

  const errors = validateTemplateDefinition(next);
  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }

  const templates = await getPlatformTemplates();
  const updated = [next, ...templates];
  await saveTemplates(updated);
  return next;
}

export async function getPlatformWorkspaces(ownerId?: string): Promise<BuilderWorkspace[]> {
  const workspaces = parseJsonArray<BuilderWorkspace>(await getAppState(WORKSPACE_KEY));
  if (!ownerId) return workspaces;
  return workspaces.filter((workspace) => workspace.ownerId === ownerId);
}

export async function createPlatformWorkspace(
  ownerId: string,
  templateIds: string[]
): Promise<BuilderWorkspace> {
  const workspaceSeed = createWorkspace(ownerId, templateIds);
  const workspace: BuilderWorkspace = {
    ...workspaceSeed,
    workspaceId: `wk_${Crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
  };

  const workspaces = await getPlatformWorkspaces();
  const updated = [workspace, ...workspaces];
  await saveWorkspaces(updated);
  return workspace;
}

export async function setPlatformWorkspacePublished(
  workspaceId: string,
  published: boolean
): Promise<void> {
  const workspaces = await getPlatformWorkspaces();
  const updated = workspaces.map((workspace) => {
    if (workspace.workspaceId !== workspaceId) return workspace;
    return {
      ...workspace,
      published,
    };
  });
  await saveWorkspaces(updated);
}

export async function getPlatformStudioOverview(ownerId: string): Promise<{
  templates: ProgramTemplateDefinition[];
  workspaces: BuilderWorkspace[];
  publishedCount: number;
}> {
  const [templates, workspaces] = await Promise.all([
    getPlatformTemplates(),
    getPlatformWorkspaces(ownerId),
  ]);

  return {
    templates,
    workspaces,
    publishedCount: workspaces.filter((workspace) => workspace.published).length,
  };
}
