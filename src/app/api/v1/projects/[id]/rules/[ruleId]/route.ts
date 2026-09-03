import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/apiResponse';
import { getCurrentUser } from '@/lib/session';
import { createRuleSchema } from '@/lib/validation/schemas';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

async function loadRule(projectId: string, ruleId: string, organizationId: string) {
  const rule = await prisma.rule.findUnique({ where: { id: ruleId }, include: { project: true } });
  if (!rule || rule.projectId !== projectId || rule.project.organizationId !== organizationId) return null;
  return rule;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; ruleId: string } },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, 'Not authenticated');
  if (user.role === 'MEMBER') return jsonError(403, 'Insufficient permissions');

  const rule = await loadRule(params.id, params.ruleId, user.organizationId);
  if (!rule) return jsonError(404, 'Rule not found');

  const parsed = createRuleSchema.partial().safeParse(await req.json());
  if (!parsed.success) return jsonError(422, 'Invalid request body', parsed.error.flatten());

  const updated = await prisma.rule.update({
    where: { id: rule.id },
    data: {
      name: parsed.data.name,
      condition: parsed.data.condition as never,
      action: parsed.data.action,
      priority: parsed.data.priority,
      enabled: parsed.data.enabled,
    },
  });

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: 'rule.updated',
    targetType: 'Rule',
    targetId: rule.id,
  });

  return jsonOk({ data: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; ruleId: string } },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, 'Not authenticated');
  if (user.role === 'MEMBER') return jsonError(403, 'Insufficient permissions');

  const rule = await loadRule(params.id, params.ruleId, user.organizationId);
  if (!rule) return jsonError(404, 'Rule not found');

  await prisma.rule.delete({ where: { id: rule.id } });

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: 'rule.deleted',
    targetType: 'Rule',
    targetId: rule.id,
  });

  return jsonOk({ data: { deleted: true } });
}
