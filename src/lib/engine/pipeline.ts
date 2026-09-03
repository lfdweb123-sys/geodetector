import { decide } from './decision';
import { reverseGeocode as defaultReverseGeocode, type GeocodedPlace } from './gps';
import type { IpIntelligenceProvider } from './ipIntelligence/types';
import {
  evaluateRules,
  ruleActionToDecision,
  type RuleDefinition,
  type RuleFacts,
} from './rulesEngine';
import { scoreVerification } from './scoring';
import type {
  ClientContext,
  Decision,
  DeviceSignals,
  Evidence,
  GpsInput,
  IpIntelligenceResult,
  ProjectMode,
  ScoringThresholds,
  ScoringWeights,
  VerificationStatus,
} from './types';

export interface VerificationRequest {
  sessionId: string;
  requiredCountry?: string;
  location?: GpsInput | null;
  locationPermissionDenied?: boolean;
  client?: ClientContext;
  device?: DeviceSignals;
  /** Resolved server-side from the connection, never trusted from the request body. */
  ip: string;
}

export interface ProjectConfig {
  mode: ProjectMode;
  requireLocation: boolean;
  allowedCountries: string[];
  maxAccuracyMeters: number;
  maxLocationAgeSec: number;
  weights: ScoringWeights;
  thresholds: ScoringThresholds;
}

export interface PipelineDeps {
  ipProvider: IpIntelligenceProvider;
  reverseGeocode?: (lat: number, lng: number) => Promise<GeocodedPlace | null>;
  rules?: RuleDefinition[];
  now?: number;
}

export interface PipelineResult {
  status: VerificationStatus;
  decision: Decision;
  confidence: number;
  evidence: Evidence[];
  reasons: string[];
  resolvedLocation: { country?: string; region?: string; city?: string };
  ip: IpIntelligenceResult;
  mockLocationStatus: 'DETECTED' | 'NOT_DETECTED' | 'UNAVAILABLE';
  ruleTrace: { ruleId: string; ruleName: string; action: string } | null;
}

export async function runVerificationPipeline(
  request: VerificationRequest,
  project: ProjectConfig,
  deps: PipelineDeps,
): Promise<PipelineResult> {
  const now = deps.now ?? Date.now();
  const geocode = deps.reverseGeocode ?? defaultReverseGeocode;
  const device = request.device ?? {};
  const mockLocationStatus = device.mockLocationStatus ?? 'UNAVAILABLE';

  const ip = await deps.ipProvider.lookup(request.ip);

  let gpsLocation: GeocodedPlace | null = null;
  if (request.location) {
    gpsLocation = await geocode(request.location.latitude, request.location.longitude);
  }

  const scoring = scoreVerification({
    gps: request.location ?? null,
    gpsLocation,
    ip,
    requiredCountry: request.requiredCountry,
    clientContext: request.client ?? {},
    device,
    maxAccuracyMeters: project.maxAccuracyMeters,
    maxLocationAgeSec: project.maxLocationAgeSec,
    weights: project.weights,
    now,
  });

  const trustworthyGps = !!request.location && mockLocationStatus !== 'DETECTED';
  const resolvedCountry = trustworthyGps ? gpsLocation?.country : ip.country;

  const base = decide({
    scoring,
    thresholds: project.thresholds,
    mode: project.mode,
    requireLocation: project.requireLocation,
    locationProvided: !!request.location,
    permissionDenied: !!request.locationPermissionDenied,
    allowedCountries: project.allowedCountries,
    resolvedCountry,
    mockLocationStatus,
    deviceIntegrityAvailable: !!device.integrity && device.integrity !== 'UNAVAILABLE',
    gpsAccuracyMeters: request.location?.accuracy,
    maxAccuracyMeters: project.maxAccuracyMeters,
  });

  let finalDecision = base.decision;
  let ruleTrace: PipelineResult['ruleTrace'] = null;
  const reasons = [...base.reasons];

  if (deps.rules && deps.rules.length > 0) {
    const facts: RuleFacts = {
      confidence: scoring.confidence,
      status: base.status,
      country: resolvedCountry,
      gpsCountry: trustworthyGps ? gpsLocation?.country : undefined,
      ipCountry: ip.country,
      requiredCountry: request.requiredCountry,
      vpn: ip.vpn,
      proxy: ip.proxy,
      tor: ip.tor,
      datacenter: ip.datacenter,
      mockLocation: mockLocationStatus === 'DETECTED',
      mockLocationStatus,
      deviceIntegrity: device.integrity ?? 'UNAVAILABLE',
      gpsAccuracyMeters: request.location?.accuracy,
    };
    const match = evaluateRules(deps.rules, facts);
    if (match) {
      finalDecision = ruleActionToDecision(match.action);
      ruleTrace = match;
      reasons.push(`Rule "${match.ruleName}" matched and set the decision to ${match.action}`);
    }
  }

  return {
    status: base.status,
    decision: finalDecision,
    confidence: scoring.confidence,
    evidence: scoring.evidence,
    reasons,
    resolvedLocation: {
      country: resolvedCountry,
      region: trustworthyGps ? gpsLocation?.region : undefined,
      city: trustworthyGps ? gpsLocation?.city : undefined,
    },
    ip,
    mockLocationStatus,
    ruleTrace,
  };
}
