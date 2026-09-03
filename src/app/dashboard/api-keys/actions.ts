'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { generateApiKey } from '@/lib/security/apiKeys';
import { logAudit } from '@/lib/audit';
import type { ActionState } from '../FormWithToast';

export async function createApiKeyAction(formData: FormData): Promise<{ rawKey: string; hmacSecret: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const projectId = String(formData.get('projectId') ?? '');
  const name = String(formData.get('name') ?? '').trim() || 'Default key';
  const env = String(formData.get('env') ?? 'live') as 'live' | 'test';

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.organizationId !== user.organizationId) throw new Error('Project not found');

  const generated = generateApiKey(env);
  await prisma.apiKey.create({
    data: {
      projectId,
      name,
      prefix: generated.prefix,
      hashedKey: generated.hashedKey,
      hmacSecret: generated.hmacSecret,
    },
  });

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: 'api_key.created',
    targetType: 'ApiKey',
  });

  revalidatePath('/dashboard/api-keys');
  return { rawKey: generated.rawKey, hmacSecret: generated.hmacSecret };
}

export async function revokeApiKeyAction(
  apiKeyId: string,
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Non authentifié.' };

  const apiKey = await prisma.apiKey.findUnique({ where: { id: apiKeyId }, include: { project: true } });
  if (!apiKey || apiKey.project.organizationId !== user.organizationId) {
    return { ok: false, message: 'Clé API introuvable.' };
  }

  await prisma.apiKey.update({ where: { id: apiKeyId }, data: { revokedAt: new Date() } });

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: 'api_key.revoked',
    targetType: 'ApiKey',
    targetId: apiKeyId,
  });

  revalidatePath('/dashboard/api-keys');
  return { ok: true, message: `Clé "${apiKey.name}" révoquée.` };
}
