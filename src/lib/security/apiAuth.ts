import { NextRequest } from 'next/server';
import { prisma } from '../db';
import { extractBearerToken, hashApiKey } from './apiKeys';
import { checkRateLimit } from './rateLimit';

export interface AuthenticatedKey {
  apiKeyId: string;
  projectId: string;
  organizationId: string;
  hmacSecret: string;
  scopes: string[];
}

export type ApiAuthResult =
  | { ok: true; key: AuthenticatedKey }
  | { ok: false; status: number; error: string };

export async function authenticateApiRequest(req: NextRequest): Promise<ApiAuthResult> {
  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token || !token.startsWith('gl_')) {
    return { ok: false, status: 401, error: 'Missing or malformed API key' };
  }

  const hashedKey = hashApiKey(token);
  const apiKey = await prisma.apiKey.findUnique({
    where: { hashedKey },
    include: { project: { select: { id: true, organizationId: true } } },
  });

  if (!apiKey || apiKey.revokedAt) {
    return { ok: false, status: 401, error: 'Invalid or revoked API key' };
  }

  const rate = await checkRateLimit(`apikey:${apiKey.id}`);
  if (!rate.allowed) {
    return { ok: false, status: 429, error: 'Rate limit exceeded' };
  }

  prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return {
    ok: true,
    key: {
      apiKeyId: apiKey.id,
      projectId: apiKey.projectId,
      organizationId: apiKey.project.organizationId,
      hmacSecret: apiKey.hmacSecret,
      scopes: apiKey.scopes,
    },
  };
}

/**
 * Best-effort client IP resolution behind Vercel's edge network. `x-forwarded-for`
 * can list multiple hops (client, proxies) - the first entry is the original client.
 * Never trust an IP supplied in the request body.
 */
export function resolveClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return '0.0.0.0';
}
