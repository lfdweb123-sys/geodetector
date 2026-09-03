import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/apiResponse';
import { getCurrentUser } from '@/lib/session';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, 'Not authenticated');
  if (user.role === 'MEMBER') return jsonError(403, 'Insufficient permissions');

  const apiKey = await prisma.apiKey.findUnique({ where: { id: params.id }, include: { project: true } });
  if (!apiKey || apiKey.project.organizationId !== user.organizationId) {
    return jsonError(404, 'API key not found');
  }

  await prisma.apiKey.update({ where: { id: apiKey.id }, data: { revokedAt: new Date() } });

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: 'api_key.revoked',
    targetType: 'ApiKey',
    targetId: apiKey.id,
  });

  return jsonOk({ data: { revoked: true } });
}
