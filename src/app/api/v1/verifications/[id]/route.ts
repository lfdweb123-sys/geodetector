import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/apiResponse';
import { authenticateApiRequest } from '@/lib/security/apiAuth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return jsonError(auth.status, auth.error);

  const verification = await prisma.verification.findUnique({ where: { id: params.id } });
  if (!verification || verification.projectId !== auth.key.projectId) {
    return jsonError(404, 'Verification not found');
  }

  return jsonOk({
    id: verification.id,
    status: verification.status,
    decision: verification.decision,
    location: {
      country: verification.locationCountry,
      region: verification.locationRegion,
      city: verification.locationCity,
    },
    confidence: verification.confidence,
    vpn: verification.vpnDetected,
    proxy: verification.proxyDetected,
    tor: verification.torDetected,
    datacenter: verification.datacenterDetected,
    mock_location: verification.mockLocationStatus,
    reasons: verification.reasons,
    created_at: verification.createdAt.toISOString(),
  });
}
