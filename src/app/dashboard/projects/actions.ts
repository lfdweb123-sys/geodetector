'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS } from '@/lib/engine/types';
import { logAudit } from '@/lib/audit';
import type { Prisma } from '@prisma/client';
import type { ActionState } from '../FormWithToast';

export async function createProject(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const name = String(formData.get('name') ?? '').trim();
  if (!name) throw new Error('Name is required');
  const mode = String(formData.get('mode') ?? 'STANDARD') as
    | 'STANDARD'
    | 'STRICT'
    | 'HIGH_SECURITY'
    | 'CUSTOM';
  const allowedCountries = formData.getAll('allowedCountries').map((c) => String(c).toUpperCase());
  const requireLocation = formData.get('requireLocation') === 'on';

  const project = await prisma.project.create({
    data: {
      organizationId: user.organizationId,
      name,
      mode,
      allowedCountries,
      requireLocation,
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

  revalidatePath('/dashboard/projects');
  redirect(`/dashboard/projects/${project.id}`);
}

export async function updateProjectSettings(
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

  const allowedCountries = formData.getAll('allowedCountries').map((c) => String(c).toUpperCase());

  try {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        name: String(formData.get('name') ?? project.name),
        mode: String(formData.get('mode') ?? project.mode) as typeof project.mode,
        allowedCountries,
        requireLocation: formData.get('requireLocation') === 'on',
        maxAccuracyMeters: Number(formData.get('maxAccuracyMeters') ?? project.maxAccuracyMeters),
        maxLocationAgeSec: Number(formData.get('maxLocationAgeSec') ?? project.maxLocationAgeSec),
        ipIntelProvider: String(formData.get('ipIntelProvider') ?? project.ipIntelProvider),
      },
    });
  } catch {
    return { ok: false, message: "Échec de l'enregistrement des réglages." };
  }

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: 'project.updated',
    targetType: 'Project',
    targetId: projectId,
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { ok: true, message: 'Réglages du projet enregistrés.' };
}
