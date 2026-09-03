'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { logAudit } from '@/lib/audit';

export async function updateOrganizationSettings(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  if (user.role !== 'OWNER') throw new Error('Only the organization owner can change these settings');

  const name = String(formData.get('name') ?? '').trim();
  const billingEmail = String(formData.get('billingEmail') ?? '').trim() || null;
  const dataRetentionDays = Number(formData.get('dataRetentionDays') ?? 90);

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: { name, billingEmail, dataRetentionDays },
  });

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: 'organization.updated',
    targetType: 'Organization',
    targetId: user.organizationId,
  });

  revalidatePath('/dashboard/settings');
}
