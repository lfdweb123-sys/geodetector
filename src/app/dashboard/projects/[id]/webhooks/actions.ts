'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { logAudit } from '@/lib/audit';

async function assertOwnership(projectId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.organizationId !== user.organizationId) throw new Error('Project not found');
  return user;
}

const ALL_EVENTS = [
  'verification.completed',
  'verification.verified',
  'verification.suspicious',
  'verification.rejected',
];

export async function createWebhook(projectId: string, formData: FormData) {
  const user = await assertOwnership(projectId);
  const url = String(formData.get('url') ?? '').trim();
  const events = ALL_EVENTS.filter((e) => formData.get(`event_${e}`) === 'on');
  if (events.length === 0) throw new Error('Select at least one event');

  const webhook = await prisma.webhook.create({
    data: { projectId, url, events, secret: randomBytes(32).toString('hex') },
  });

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: 'webhook.created',
    targetType: 'Webhook',
    targetId: webhook.id,
  });

  revalidatePath(`/dashboard/projects/${projectId}/webhooks`);
}

export async function deleteWebhook(projectId: string, webhookId: string) {
  const user = await assertOwnership(projectId);
  await prisma.webhook.delete({ where: { id: webhookId } });
  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: 'webhook.deleted',
    targetType: 'Webhook',
    targetId: webhookId,
  });
  revalidatePath(`/dashboard/projects/${projectId}/webhooks`);
}
