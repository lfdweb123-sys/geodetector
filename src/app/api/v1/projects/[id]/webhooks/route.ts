import { NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/apiResponse';
import { getCurrentUser } from '@/lib/session';
import { createWebhookSchema } from '@/lib/validation/schemas';
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

  const webhooks = await prisma.webhook.findMany({
    where: { projectId: project.id },
    select: { id: true, url: true, events: true, enabled: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return jsonOk({ data: webhooks });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, 'Not authenticated');
  if (user.role === 'MEMBER') return jsonError(403, 'Insufficient permissions');
  const project = await assertProjectOwnership(params.id, user.organizationId);
  if (!project) return jsonError(404, 'Project not found');

  const parsed = createWebhookSchema.safeParse({ ...(await req.json()), projectId: project.id });
  if (!parsed.success) return jsonError(422, 'Invalid request body', parsed.error.flatten());

  const webhook = await prisma.webhook.create({
    data: {
      projectId: project.id,
      url: parsed.data.url,
      events: parsed.data.events,
      secret: randomBytes(32).toString('hex'),
    },
  });

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: 'webhook.created',
    targetType: 'Webhook',
    targetId: webhook.id,
  });

  return jsonOk({ data: { id: webhook.id, url: webhook.url, events: webhook.events, secret: webhook.secret } }, 201);
}
