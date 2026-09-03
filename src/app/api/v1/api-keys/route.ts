import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/apiResponse';
import { getCurrentUser } from '@/lib/session';
import { createApiKeySchema } from '@/lib/validation/schemas';
import { generateApiKey } from '@/lib/security/apiKeys';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, 'Not authenticated');

  const projectId = req.nextUrl.searchParams.get('projectId');
  const keys = await prisma.apiKey.findMany({
    where: {
      project: { organizationId: user.organizationId },
      ...(projectId ? { projectId } : {}),
    },
    select: {
      id: true,
      projectId: true,
      name: true,
      prefix: true,
      scopes: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return jsonOk({ data: keys });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, 'Not authenticated');
  if (user.role === 'MEMBER') return jsonError(403, 'Insufficient permissions');

  const parsed = createApiKeySchema.safeParse(await req.json());
  if (!parsed.success) return jsonError(422, 'Invalid request body', parsed.error.flatten());

  const project = await prisma.project.findUnique({ where: { id: parsed.data.projectId } });
  if (!project || project.organizationId !== user.organizationId) return jsonError(404, 'Project not found');

  const generated = generateApiKey(parsed.data.env);
  const apiKey = await prisma.apiKey.create({
    data: {
      projectId: project.id,
      name: parsed.data.name,
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
    targetId: apiKey.id,
  });

  // The raw key and HMAC secret are returned exactly once - GeoLock never stores
  // or displays them again after this response (spec ยง19: API keys are hashed).
  return jsonOk(
    {
      data: {
        id: apiKey.id,
        name: apiKey.name,
        prefix: apiKey.prefix,
        key: generated.rawKey,
        hmac_secret: generated.hmacSecret,
        createdAt: apiKey.createdAt,
      },
    },
    201,
  );
}
