'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { ruleConditionSchema } from '@/lib/validation/schemas';
import { logAudit } from '@/lib/audit';

async function assertOwnership(projectId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.organizationId !== user.organizationId) throw new Error('Project not found');
  return user;
}

export async function createRule(projectId: string, formData: FormData) {
  const user = await assertOwnership(projectId);

  const name = String(formData.get('name') ?? '').trim();
  const action = String(formData.get('action') ?? 'BLOCK') as 'ALLOW' | 'BLOCK' | 'MANUAL_REVIEW';
  const priority = Number(formData.get('priority') ?? 0);
  const conditionRaw = String(formData.get('condition') ?? '{}');

  let condition: unknown;
  try {
    condition = JSON.parse(conditionRaw);
  } catch {
    throw new Error('Condition must be valid JSON');
  }
  const parsed = ruleConditionSchema.safeParse(condition);
  if (!parsed.success) throw new Error('Invalid rule condition shape');

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
}

export async function toggleRule(projectId: string, ruleId: string) {
  await assertOwnership(projectId);
  const rule = await prisma.rule.findUniqueOrThrow({ where: { id: ruleId } });
  await prisma.rule.update({ where: { id: ruleId }, data: { enabled: !rule.enabled } });
  revalidatePath(`/dashboard/projects/${projectId}/rules`);
}

export async function deleteRule(projectId: string, ruleId: string) {
  await assertOwnership(projectId);
  await prisma.rule.delete({ where: { id: ruleId } });
  revalidatePath(`/dashboard/projects/${projectId}/rules`);
}
