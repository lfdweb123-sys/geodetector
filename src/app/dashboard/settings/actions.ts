'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import type { ActionState } from '../FormWithToast';

export async function updateOrganizationSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Non authentifié.' };
  if (user.role !== 'OWNER') {
    return { ok: false, message: 'Seul le propriétaire de l’organisation peut modifier ces réglages.' };
  }

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
  return { ok: true, message: 'Réglages enregistrés.' };
}
