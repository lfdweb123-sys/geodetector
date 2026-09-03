'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS } from '@/lib/engine/types';
import { logAudit } from '@/lib/audit';
import type { Prisma } from '@prisma/client';

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
  const allowedCountriesRaw = String(formData.get('allowedCountries') ?? '');
  const allowedCountries = allowedCountriesRaw
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
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

export async function updateProjectSettings(projectId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.organizationId !== user.organizationId) throw new Error('Project not found');

  const allowedCountries = String(formData.get('allowedCountries') ?? '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

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

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: 'project.updated',
    targetType: 'Project',
    targetId: projectId,
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
}
