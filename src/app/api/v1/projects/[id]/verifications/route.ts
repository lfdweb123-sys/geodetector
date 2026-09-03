import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/apiResponse';
import { getCurrentUser } from '@/lib/session';

export const runtime = 'nodejs';

/** Dashboard-only listing endpoint (session-authenticated), separate from the
 * API-key-authenticated `/v1/verifications/:id` lookup customers integrate with. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, 'Not authenticated');

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project || project.organizationId !== user.organizationId) return jsonError(404, 'Project not found');

  const take = Math.min(100, Number(req.nextUrl.searchParams.get('limit') ?? 25));
  const cursor = req.nextUrl.searchParams.get('cursor') ?? undefined;

  const verifications = await prisma.verification.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'desc' },
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true,
      sessionId: true,
      status: true,
      decision: true,
      confidence: true,
      locationCountry: true,
      locationCity: true,
      vpnDetected: true,
      mockLocationStatus: true,
      createdAt: true,
    },
  });

  return jsonOk({
    data: verifications,
    nextCursor: verifications.length === take ? verifications[verifications.length - 1]!.id : null,
  });
}
