import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/apiResponse';
import { authenticateApiRequest, resolveClientIp } from '@/lib/security/apiAuth';
import { claimNonce } from '@/lib/security/replay';
import {
  isTimestampFresh,
  NONCE_HEADER,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifySignature,
} from '@/lib/security/signature';
import { issueVerificationToken } from '@/lib/security/verificationToken';
import { getActiveScoringConfig, toProjectConfig } from '@/lib/projectConfig';
import { getIpIntelligenceProvider } from '@/lib/engine/ipIntelligence';
import { runVerificationPipeline } from '@/lib/engine/pipeline';
import type { RuleDefinition } from '@/lib/engine/rulesEngine';
import { createVerificationSchema } from '@/lib/validation/schemas';
import { dispatchWebhooks } from '@/lib/webhooks/dispatch';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return jsonError(auth.status, auth.error);

  const rawBody = await req.text();

  // Request signing is optional: integrators who send the signature headers get
  // full anti-replay + tamper-evidence (spec ยง21); a bearer key alone still works.
  const signature = req.headers.get(SIGNATURE_HEADER);
  if (signature) {
    const timestamp = req.headers.get(TIMESTAMP_HEADER);
    const nonce = req.headers.get(NONCE_HEADER);
    if (!timestamp || !nonce) {
      return jsonError(400, 'Signed requests require X-GeoLock-Timestamp and X-GeoLock-Nonce headers');
    }
    if (!isTimestampFresh(timestamp)) {
      return jsonError(401, 'Request timestamp is outside the allowed window');
    }
    const valid = verifySignature({ secret: auth.key.hmacSecret, timestamp, nonce, rawBody, signature });
    if (!valid) return jsonError(401, 'Invalid request signature');
    const fresh = await claimNonce(auth.key.projectId, nonce);
    if (!fresh) return jsonError(409, 'Replayed request (nonce already used)');
  }

  let body: unknown;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }

  const parsed = createVerificationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(422, 'Invalid request body', parsed.error.flatten());
  }
  const input = parsed.data;

  const project = await prisma.project.findUnique({ where: { id: auth.key.projectId } });
  if (!project) return jsonError(404, 'Project not found');

  const scoringConfig = await getActiveScoringConfig(project.id);
  const projectConfig = toProjectConfig(project, scoringConfig);

  const rules = await prisma.rule.findMany({ where: { projectId: project.id, enabled: true } });
  const ruleDefinitions: RuleDefinition[] = rules.map((r) => ({
    id: r.id,
    name: r.name,
    condition: r.condition as never,
    action: r.action,
    priority: r.priority,
    enabled: r.enabled,
  }));

  const ipProvider = getIpIntelligenceProvider(project.ipIntelProvider);

  const result = await runVerificationPipeline(
    {
      sessionId: input.session_id,
      requiredCountry: input.required_country,
      location: input.location ?? null,
      locationPermissionDenied: input.location_permission_denied,
      client: input.client,
      device: input.device,
      ip: resolveClientIp(req),
    },
    projectConfig,
    { ipProvider, rules: ruleDefinitions },
  );

  const verificationId = `ver_${crypto.randomUUID().replace(/-/g, '')}`;
  const { token, tokenHash, expiresAt } = issueVerificationToken(verificationId, input.session_id);

  await prisma.verification.create({
    data: {
      id: verificationId,
      projectId: project.id,
      sessionId: input.session_id,
      requiredCountry: input.required_country,
      status: result.status,
      decision: result.decision,
      confidence: result.confidence,
      locationCountry: result.resolvedLocation.country,
      locationRegion: result.resolvedLocation.region,
      locationCity: result.resolvedLocation.city,
      locationLat: input.location?.latitude,
      locationLng: input.location?.longitude,
      locationAccuracyM: input.location?.accuracy,
      ip: result.ip.ip,
      ipCountry: result.ip.country,
      vpnDetected: result.ip.vpn,
      proxyDetected: result.ip.proxy,
      torDetected: result.ip.tor,
      datacenterDetected: result.ip.datacenter,
      mockLocationStatus: result.mockLocationStatus,
      deviceIntegrity: input.device?.integrity,
      timezone: input.client?.timezone,
      language: input.client?.language,
      reasons: result.reasons,
      signals: result.evidence as unknown as object,
      tokenHash,
      expiresAt,
      ruleTrace: result.ruleTrace as unknown as object,
    },
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  await prisma.usageRecord.upsert({
    where: { projectId_day: { projectId: project.id, day: today } },
    update: { count: { increment: 1 } },
    create: { projectId: project.id, day: today, count: 1 },
  });

  await dispatchWebhooks({
    projectId: project.id,
    verificationId,
    status: result.status,
    decision: result.decision,
    confidence: result.confidence,
  }).catch(() => {});

  return jsonOk(
    {
      id: verificationId,
      status: result.status,
      decision: result.decision,
      location: {
        country: result.resolvedLocation.country ?? null,
        region: result.resolvedLocation.region ?? null,
        city: result.resolvedLocation.city ?? null,
      },
      confidence: result.confidence,
      vpn: result.ip.vpn,
      proxy: result.ip.proxy,
      tor: result.ip.tor,
      datacenter: result.ip.datacenter,
      mock_location: result.mockLocationStatus,
      reasons: result.reasons,
      token,
      expires_at: expiresAt.toISOString(),
    },
    201,
  );
}
