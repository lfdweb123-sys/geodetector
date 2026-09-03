import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/apiResponse';
import { getCurrentUser } from '@/lib/session';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; webhookId: string } },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, 'Not authenticated');
  if (user.role === 'MEMBER') return jsonError(403, 'Insufficient permissions');

  const webhook = await prisma.webhook.findUnique({ where: { id: params.webhookId }, include: { project: true } });
  if (!webhook || webhook.projectId !== params.id || webhook.project.organizationId !== user.organizationId) {
    return jsonError(404, 'Webhook not found');
  }

  await prisma.webhook.delete({ where: { id: webhook.id } });

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: 'webhook.deleted',
    targetType: 'Webhook',
    targetId: webhook.id,
  });

  return jsonOk({ data: { deleted: true } });
}
