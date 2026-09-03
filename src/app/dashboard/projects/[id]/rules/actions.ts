'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { ruleConditionSchema } from '@/lib/validation/schemas';
import { logAudit } from '@/lib/audit';
import type { ActionState } from '../../../FormWithToast';

async function assertOwnership(projectId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.organizationId !== user.organizationId) throw new Error('Project not found');
  return user;
}

export async function createRule(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertOwnership(projectId);

  const name = String(formData.get('name') ?? '').trim();
  const action = String(formData.get('action') ?? 'BLOCK') as 'ALLOW' | 'BLOCK' | 'MANUAL_REVIEW';
  const priority = Number(formData.get('priority') ?? 0);
  const conditionRaw = String(formData.get('condition') ?? '{}');

  if (!name) return { ok: false, message: 'Le nom de la règle est requis.' };

  let condition: unknown;
  try {
    condition = JSON.parse(conditionRaw);
  } catch {
    return { ok: false, message: 'La condition doit être un JSON valide.' };
  }
  const parsed = ruleConditionSchema.safeParse(condition);
  if (!parsed.success) return { ok: false, message: 'Forme de condition invalide.' };

  const rule = await prisma.rule.create({
    data: { projectId, name, action, priority, condition: parsed.data as never },
  });

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: 'rule.created',
    targetType: 'Rule',
    targetId: rule.id,
  });

  revalidatePath(`/dashboard/projects/${projectId}/rules`);
  return { ok: true, message: `Règle "${name}" créée.` };
}

export async function toggleRule(
  projectId: string,
  ruleId: string,
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  await assertOwnership(projectId);
  const rule = await prisma.rule.findUniqueOrThrow({ where: { id: ruleId } });
  const updated = await prisma.rule.update({ where: { id: ruleId }, data: { enabled: !rule.enabled } });
  revalidatePath(`/dashboard/projects/${projectId}/rules`);
  return { ok: true, message: updated.enabled ? `Règle "${updated.name}" activée.` : `Règle "${updated.name}" désactivée.` };
}

export async function deleteRule(
  projectId: string,
  ruleId: string,
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  await assertOwnership(projectId);
  const rule = await prisma.rule.delete({ where: { id: ruleId } });
  revalidatePath(`/dashboard/projects/${projectId}/rules`);
  return { ok: true, message: `Règle "${rule.name}" supprimée.` };
}
