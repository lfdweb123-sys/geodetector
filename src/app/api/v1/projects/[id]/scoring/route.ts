import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/apiResponse';
import { getCurrentUser } from '@/lib/session';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

const weightsSchema = z.record(z.string(), z.number());
const thresholdsSchema = z.object({ verifiedMin: z.number().min(0).max(100), suspiciousMin: z.number().min(0).max(100) });

const bodySchema = z.object({ weights: weightsSchema, thresholds: thresholdsSchema });

/**
 * Publishes a new, immutable scoring-config version and marks it active
 * (spec ยง12: weights must be editable from the dashboard, without ever
 * mutating the record used to explain a past decision).
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, 'Not authenticated');
  if (user.role === 'MEMBER') return jsonError(403, 'Insufficient permissions');

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project || project.organizationId !== user.organizationId) return jsonError(404, 'Project not found');

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return jsonError(422, 'Invalid request body', parsed.error.flatten());

  const latest = await prisma.scoringConfig.findFirst({
    where: { projectId: project.id },
    orderBy: { version: 'desc' },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const [, created] = await prisma.$transaction([
    prisma.scoringConfig.updateMany({ where: { projectId: project.id, isActive: true }, data: { isActive: false } }),
    prisma.scoringConfig.create({
      data: {
        projectId: project.id,
        version: nextVersion,
        isActive: true,
        weights: parsed.data.weights,
        thresholds: parsed.data.thresholds,
      },
    }),
  ]);

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: 'scoring_config.updated',
    targetType: 'ScoringConfig',
    targetId: created.id,
  });

  return jsonOk({ data: created });
}
