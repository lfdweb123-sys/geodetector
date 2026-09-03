'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { DEFAULT_WEIGHTS, type ScoringWeights } from '@/lib/engine/types';
import { logAudit } from '@/lib/audit';
import type { Prisma } from '@prisma/client';
import type { ActionState } from '../../../FormWithToast';

export async function updateScoringConfig(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Non authentifié.' };
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.organizationId !== user.organizationId) {
    return { ok: false, message: 'Projet introuvable.' };
  }

  const weights = {} as ScoringWeights;
  for (const key of Object.keys(DEFAULT_WEIGHTS) as (keyof ScoringWeights)[]) {
    const raw = formData.get(`weight_${key}`);
    weights[key] = raw !== null ? Number(raw) : DEFAULT_WEIGHTS[key];
  }

  const thresholds = {
    verifiedMin: Number(formData.get('verifiedMin') ?? 85),
    suspiciousMin: Number(formData.get('suspiciousMin') ?? 40),
  };

  const latest = await prisma.scoringConfig.findFirst({ where: { projectId }, orderBy: { version: 'desc' } });
  const nextVersion = (latest?.version ?? 0) + 1;

  await prisma.$transaction([
    prisma.scoringConfig.updateMany({ where: { projectId, isActive: true }, data: { isActive: false } }),
    prisma.scoringConfig.create({
      data: {
        projectId,
        version: nextVersion,
        isActive: true,
        weights: weights as unknown as Prisma.InputJsonValue,
        thresholds: thresholds as unknown as Prisma.InputJsonValue,
      },
    }),
  ]);

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: 'scoring_config.updated',
    targetType: 'ScoringConfig',
    targetId: projectId,
  });

  revalidatePath(`/dashboard/projects/${projectId}/scoring`);
  return { ok: true, message: `Version ${nextVersion} des poids de scoring publiée.` };
}
