import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/apiResponse';
import { getCurrentUser } from '@/lib/session';
import { createProjectSchema } from '@/lib/validation/schemas';
import { logAudit } from '@/lib/audit';
import { DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS } from '@/lib/engine/types';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, 'Not authenticated');

  const projects = await prisma.project.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: 'desc' },
  });
  return jsonOk({ data: projects });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, 'Not authenticated');

  const parsed = createProjectSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError(422, 'Invalid request body', parsed.error.flatten());
  const input = parsed.data;

  const project = await prisma.project.create({
    data: {
      organizationId: user.organizationId,
      name: input.name,
      mode: input.mode,
      allowedCountries: input.allowedCountries,
      requireLocation: input.requireLocation,
      maxAccuracyMeters: input.maxAccuracyMeters,
      maxLocationAgeSec: input.maxLocationAgeSec,
      minConfidence: input.minConfidence,
      ipIntelProvider: input.ipIntelProvider,
      scoringConfigs: {
        create: {
          version: 1,
          isActive: true,
          weights: DEFAULT_WEIGHTS as unknown as Prisma.InputJsonValue,
          thresholds: DEFAULT_THRESHOLDS as unknown as Prisma.InputJsonValue,
        },
      },
    },
  });

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: 'project.created',
    targetType: 'Project',
    targetId: project.id,
  });

  return jsonOk({ data: project }, 201);
}
