import { prisma } from './db';
import type { Prisma } from '@prisma/client';

export async function logAudit(params: {
  organizationId: string;
  userId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}) {
  await prisma.auditLog.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
      ip: params.ip,
    },
  });
}
