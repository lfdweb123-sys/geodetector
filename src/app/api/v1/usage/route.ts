import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/apiResponse';
import { authenticateApiRequest } from '@/lib/security/apiAuth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return jsonError(auth.status, auth.error);

  const days = Math.min(90, Number(req.nextUrl.searchParams.get('days') ?? 30));
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  since.setUTCHours(0, 0, 0, 0);

  const records = await prisma.usageRecord.findMany({
    where: { projectId: auth.key.projectId, day: { gte: since } },
    orderBy: { day: 'asc' },
  });

  const total = records.reduce((sum, r) => sum + r.count, 0);

  return jsonOk({
    data: {
      project_id: auth.key.projectId,
      period_days: days,
      total_verifications: total,
      daily: records.map((r) => ({ date: r.day.toISOString().slice(0, 10), count: r.count })),
    },
  });
}
