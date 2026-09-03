import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/apiResponse';
import { getCurrentUser } from '@/lib/session';
import { createRuleSchema } from '@/lib/validation/schemas';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

async function assertProjectOwnership(projectId: string, organizationId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  return project && project.organizationId === organizationId ? project : null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, 'Not authenticated');
  const project = await assertProjectOwnership(params.id, user.organizationId);
  if (!project) return jsonError(404, 'Project not found');

  const rules = await prisma.rule.findMany({ where: { projectId: project.id }, orderBy: { priority: 'desc' } });
  return jsonOk({ data: rules });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, 'Not authenticated');
  if (user.role === 'MEMBER') return jsonError(403, 'Insufficient permissions');
  const project = await assertProjectOwnership(params.id, user.organizationId);
  if (!project) return jsonError(404, 'Project not found');

  const parsed = createRuleSchema.safeParse({ ...(await req.json()), projectId: project.id });
  if (!parsed.success) return jsonError(422, 'Invalid request body', parsed.error.flatten());

  const rule = await prisma.rule.create({
    data: {
      projectId: project.id,
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
    action: 'rule.created',
    targetType: 'Rule',
    targetId: rule.id,
  });

  return jsonOk({ data: rule }, 201);
}
