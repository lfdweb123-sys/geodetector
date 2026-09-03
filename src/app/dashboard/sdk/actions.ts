'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { getActiveScoringConfig, toProjectConfig } from '@/lib/projectConfig';
import { getIpIntelligenceProvider } from '@/lib/engine/ipIntelligence';
import { runVerificationPipeline } from '@/lib/engine/pipeline';
import { issueVerificationToken } from '@/lib/security/verificationToken';
import type { RuleDefinition } from '@/lib/engine/rulesEngine';
import type { DeviceIntegrityStatus, MockLocationStatus } from '@/lib/engine/types';

/**
 * Runs a real verification through the same pipeline `/v1/verifications`
 * uses, session-authenticated instead of API-key-authenticated, so a project
 * owner can test detection (including live IP intelligence + reverse
 * geocoding lookups) straight from the dashboard.
 */
export async function runTestVerification(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  if (user.role === 'MEMBER') throw new Error('Insufficient permissions to run a test verification');

  const projectId = String(formData.get('projectId') ?? '');
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.organizationId !== user.organizationId) throw new Error('Project not found');

  const lat = formData.get('latitude');
  const lng = formData.get('longitude');
  const accuracy = formData.get('accuracy');
  const location =
    lat && lng
      ? {
          latitude: Number(lat),
          longitude: Number(lng),
          accuracy: Number(accuracy || 20),
          timestamp: Date.now() - Number(formData.get('ageSeconds') ?? 0) * 1000,
        }
      : null;

  const overrideIp = String(formData.get('ip') ?? '').trim();
  const requestIp = overrideIp || (headers().get('x-forwarded-for')?.split(',')[0]?.trim() ?? '203.0.113.10');

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
      sessionId: `dashboard_test_${crypto.randomUUID()}`,
      requiredCountry: String(formData.get('requiredCountry') ?? '').toUpperCase() || undefined,
      location,
      locationPermissionDenied: formData.get('permissionDenied') === 'on',
      client: {
        timezone: String(formData.get('timezone') ?? '') || undefined,
        language: String(formData.get('language') ?? '') || undefined,
      },
      device: {
        mockLocationStatus: (String(formData.get('mockLocationStatus') ?? 'UNAVAILABLE') as MockLocationStatus) || undefined,
        integrity: (String(formData.get('integrity') ?? 'UNAVAILABLE') as DeviceIntegrityStatus) || undefined,
      },
      ip: requestIp,
    },
    projectConfig,
    { ipProvider, rules: ruleDefinitions },
  );

  const verificationId = `ver_${crypto.randomUUID().replace(/-/g, '')}`;
  const { tokenHash, expiresAt } = issueVerificationToken(verificationId, 'dashboard_test');

  await prisma.verification.create({
    data: {
      id: verificationId,
      projectId: project.id,
      sessionId: `dashboard_test_${verificationId}`,
      requiredCountry: String(formData.get('requiredCountry') ?? '').toUpperCase() || undefined,
      status: result.status,
      decision: result.decision,
      confidence: result.confidence,
      locationCountry: result.resolvedLocation.country,
      locationRegion: result.resolvedLocation.region,
      locationCity: result.resolvedLocation.city,
      locationLat: location?.latitude,
      locationLng: location?.longitude,
      locationAccuracyM: location?.accuracy,
      ip: result.ip.ip,
      ipCountry: result.ip.country,
      vpnDetected: result.ip.vpn,
      proxyDetected: result.ip.proxy,
      torDetected: result.ip.tor,
      datacenterDetected: result.ip.datacenter,
      mockLocationStatus: result.mockLocationStatus,
      timezone: String(formData.get('timezone') ?? '') || undefined,
      language: String(formData.get('language') ?? '') || undefined,
      reasons: result.reasons,
      signals: result.evidence as unknown as object,
      tokenHash,
      expiresAt,
      ruleTrace: result.ruleTrace as unknown as object,
    },
  });

  redirect(`/dashboard/verifications/${verificationId}`);
}
