import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/apiResponse';
import { getCurrentUser } from '@/lib/session';
import { updateProjectSchema } from '@/lib/validation/schemas';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

async function loadOwnedProject(id: string, organizationId: string) {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || project.organizationId !== organizationId) return null;
  return project;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, 'Not authenticated');

  const project = await loadOwnedProject(params.id, user.organizationId);
  if (!project) return jsonError(404, 'Project not found');

  const scoringConfig = await prisma.scoringConfig.findFirst({
    where: { projectId: project.id, isActive: true },
    orderBy: { version: 'desc' },
  });

  return jsonOk({ data: { ...project, scoringConfig } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, 'Not authenticated');
  if (user.role === 'MEMBER') return jsonError(403, 'Insufficient permissions');

  const project = await loadOwnedProject(params.id, user.organizationId);
  if (!project) return jsonError(404, 'Project not found');

  const parsed = updateProjectSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError(422, 'Invalid request body', parsed.error.flatten());

  const updated = await prisma.project.update({ where: { id: project.id }, data: parsed.data });

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: 'project.updated',
    targetType: 'Project',
    targetId: project.id,
    metadata: parsed.data,
  });

  return jsonOk({ data: updated });
}
