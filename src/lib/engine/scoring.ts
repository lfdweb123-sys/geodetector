import { isGpsPrecise, isGpsRecent, type GeocodedPlace } from './gps';
import { isLanguagePlausibleForCountry, isTimezonePlausibleForCountry } from './consistency';
import type {
  ClientContext,
  DeviceSignals,
  Evidence,
  GpsInput,
  IpIntelligenceResult,
  ScoringResult,
  ScoringWeights,
  SignalKey,
} from './types';

export interface ScoringInput {
  gps: GpsInput | null;
  /** Reverse-geocoded place for `gps`. Ignored (treated as untrustworthy) when mock location was detected. */
  gpsLocation: GeocodedPlace | null;
  ip: IpIntelligenceResult;
  requiredCountry?: string;
  clientContext: ClientContext;
  device: DeviceSignals;
  maxAccuracyMeters: number;
  maxLocationAgeSec: number;
  weights: ScoringWeights;
  now?: number;
}

function push(
  list: Evidence[],
  key: SignalKey,
  category: Evidence['category'],
  weight: number,
  reason: string,
  opts: { value?: unknown; reliability?: number; source: string; capturedAt: string },
) {
  list.push({
    key,
    category,
    value: opts.value ?? null,
    reliability: opts.reliability ?? 0.8,
    source: opts.source,
    capturedAt: opts.capturedAt,
    weight,
    contribution: weight,
    reason,
  });
}

/**
 * Builds the full evidence trail for a verification and derives a 0-100
 * confidence score from it. This is the only place scoring weights are
 * applied - everything upstream just produces observations, everything
 * downstream (decision engine, rules engine) only reads `ScoringResult`.
 */
export function scoreVerification(input: ScoringInput): ScoringResult {
  const {
    gps,
    gpsLocation,
    ip,
    requiredCountry,
    clientContext,
    device,
    maxAccuracyMeters,
    maxLocationAgeSec,
    weights: w,
  } = input;
  const now = input.now ?? Date.now();
  const nowIso = new Date(now).toISOString();
  const evidence: Evidence[] = [];

  const mockDetected = device.mockLocationStatus === 'DETECTED';

  // --- GPS -------------------------------------------------------------
  let effectiveGpsCountry: string | undefined;
  if (!gps) {
    push(evidence, 'gps_missing', 'GPS', w.gps_missing, 'No GPS fix was provided', {
      source: 'client',
      capturedAt: nowIso,
      reliability: 1,
    });
  } else if (mockDetected) {
    // GPS coordinates cannot be trusted once mock location is detected -
    // the mock_location_detected evidence below carries the penalty; we do
    // not also credit a (possibly fabricated) precise/recent/matching fix.
  } else {
    const precise = isGpsPrecise(gps, maxAccuracyMeters);
    push(
      evidence,
      precise ? 'gps_precise' : 'gps_imprecise',
      'GPS',
      precise ? w.gps_precise : w.gps_imprecise,
      precise
        ? `GPS accuracy is ${gps.accuracy}m (within ${maxAccuracyMeters}m threshold)`
        : `GPS accuracy is ${gps.accuracy}m, coarser than the ${maxAccuracyMeters}m threshold`,
      { source: 'device_gps', capturedAt: new Date(gps.timestamp).toISOString(), value: gps.accuracy },
    );

    const recent = isGpsRecent(gps, maxLocationAgeSec, now);
    push(
      evidence,
      recent ? 'gps_recent' : 'gps_stale',
      'GPS',
      recent ? w.gps_recent : w.gps_stale,
      recent
        ? 'GPS fix is recent'
        : `GPS fix is older than the ${maxLocationAgeSec}s freshness threshold`,
      { source: 'device_gps', capturedAt: new Date(gps.timestamp).toISOString() },
    );

    effectiveGpsCountry = gpsLocation?.country;
    if (requiredCountry) {
      const match = effectiveGpsCountry === requiredCountry.toUpperCase();
      push(
        evidence,
        match ? 'gps_country_match' : 'gps_country_mismatch',
        'GPS',
        match ? w.gps_country_match : w.gps_country_mismatch,
        match
          ? `GPS location resolves to the required country (${requiredCountry})`
          : `GPS location resolves to ${effectiveGpsCountry ?? 'an unresolved country'}, not the required ${requiredCountry}`,
        { source: 'reverse_geocode', capturedAt: nowIso, value: effectiveGpsCountry },
      );
    } else if (effectiveGpsCountry) {
      push(
        evidence,
        'gps_country_match',
        'GPS',
        w.gps_country_match,
        `GPS location resolved to ${effectiveGpsCountry}`,
        { source: 'reverse_geocode', capturedAt: nowIso, value: effectiveGpsCountry },
      );
    }
  }

  // --- IP intelligence ---------------------------------------------------
  const resolvedCountry = effectiveGpsCountry ?? ip.country;
  const anonymized = ip.vpn || ip.proxy || ip.tor || ip.datacenter;
  let ipMismatchExplained = false;

  if (effectiveGpsCountry && ip.country) {
    if (ip.country === effectiveGpsCountry) {
      push(evidence, 'ip_consistent', 'IP', w.ip_consistent, 'IP location matches GPS location', {
        source: `ip_intelligence:${ip.provider}`,
        capturedAt: nowIso,
        reliability: ip.confidence,
      });
    } else if (anonymized) {
      ipMismatchExplained = true;
      push(
        evidence,
        'ip_explained_by_vpn',
        'IP',
        w.ip_consistent,
        `IP appears to be routed through ${ip.vpn ? 'a VPN' : ip.tor ? 'Tor' : ip.datacenter ? 'a datacenter' : 'a proxy'}, which plausibly explains the IP/GPS country mismatch`,
        { source: `ip_intelligence:${ip.provider}`, capturedAt: nowIso, reliability: ip.confidence },
      );
    } else {
      push(
        evidence,
        'ip_country_mismatch',
        'IP',
        w.ip_country_mismatch,
        `IP country (${ip.country}) differs from GPS country (${effectiveGpsCountry}) with no anonymization network detected`,
        { source: `ip_intelligence:${ip.provider}`, capturedAt: nowIso, reliability: ip.confidence },
      );
    }
  }

  if (ip.vpn) {
    push(evidence, 'vpn_detected', 'IP', w.vpn_detected, 'IP appears to be behind a VPN', {
      source: `ip_intelligence:${ip.provider}`,
      capturedAt: nowIso,
      reliability: ip.confidence,
    });
  } else if (ip.proxy) {
    push(evidence, 'proxy_detected', 'IP', w.proxy_detected, 'IP appears to be behind a proxy', {
      source: `ip_intelligence:${ip.provider}`,
      capturedAt: nowIso,
      reliability: ip.confidence,
    });
  }
  if (ip.tor) {
    push(evidence, 'tor_detected', 'IP', w.tor_detected, 'IP is a known Tor exit node', {
      source: `ip_intelligence:${ip.provider}`,
      capturedAt: nowIso,
      reliability: 0.99,
    });
  }
  if (ip.datacenter) {
    push(
      evidence,
      'datacenter_detected',
      'IP',
      w.datacenter_detected,
      'IP belongs to a datacenter/hosting range',
      { source: `ip_intelligence:${ip.provider}`, capturedAt: nowIso, reliability: ip.confidence },
    );
  }

  // --- Timezone / language (weak signals - spec ยง11) ---------------------
  if (clientContext.timezone && resolvedCountry) {
    const consistent = isTimezonePlausibleForCountry(clientContext.timezone, resolvedCountry);
    push(
      evidence,
      consistent ? 'timezone_consistent' : 'timezone_mismatch',
      'TIMEZONE',
      consistent ? w.timezone_consistent : w.timezone_mismatch,
      consistent
        ? `Timezone ${clientContext.timezone} is consistent with ${resolvedCountry}`
        : `Timezone ${clientContext.timezone} is not associated with ${resolvedCountry}`,
      { source: 'client', capturedAt: nowIso, reliability: 0.4 },
    );
  }
  if (clientContext.language && resolvedCountry) {
    const consistent = isLanguagePlausibleForCountry(clientContext.language, resolvedCountry);
    if (consistent) {
      push(
        evidence,
        'language_consistent',
        'LANGUAGE',
        w.language_consistent,
        `Language ${clientContext.language} is consistent with ${resolvedCountry}`,
        { source: 'client', capturedAt: nowIso, reliability: 0.2 },
      );
    }
    // A mismatched language is intentionally not penalized on its own - too
    // many legitimate users browse in a non-local language (spec ยง11).
  }

  // --- Mock location -------------------------------------------------------
  const mockStatus = device.mockLocationStatus ?? 'UNAVAILABLE';
  if (mockStatus === 'DETECTED') {
    push(
      evidence,
      'mock_location_detected',
      'MOCK_LOCATION',
      w.mock_location_detected,
      'The platform reported that mock/simulated location is active',
      { source: 'device_signals', capturedAt: nowIso, reliability: 0.9 },
    );
  } else if (mockStatus === 'NOT_DETECTED') {
    push(
      evidence,
      'mock_location_not_detected',
      'MOCK_LOCATION',
      w.mock_location_not_detected,
      'No mock/simulated location indicator was detected',
      { source: 'device_signals', capturedAt: nowIso, reliability: 0.6 },
    );
  } else {
    push(
      evidence,
      'mock_location_unavailable',
      'MOCK_LOCATION',
      w.mock_location_unavailable,
      'Mock location status could not be determined on this platform',
      { source: 'device_signals', capturedAt: nowIso, reliability: 1 },
    );
  }

  // --- Device integrity ------------------------------------------------
  if (device.integrity === 'PHYSICAL') {
    push(evidence, 'device_physical', 'DEVICE', w.device_physical, 'Device integrity checks passed', {
      source: 'device_signals',
      capturedAt: nowIso,
      reliability: 0.7,
    });
  } else if (device.integrity === 'EMULATOR_SUSPECTED') {
    push(
      evidence,
      'device_emulator_suspected',
      'DEVICE',
      w.device_emulator_suspected,
      'Device signals suggest an emulator or virtualized environment',
      { source: 'device_signals', capturedAt: nowIso, reliability: 0.6 },
    );
  } else if (device.integrity === 'COMPROMISED_SUSPECTED') {
    push(
      evidence,
      'device_compromised_suspected',
      'DEVICE',
      w.device_compromised_suspected,
      'Device signals suggest a compromised or rooted/jailbroken environment',
      { source: 'device_signals', capturedAt: nowIso, reliability: 0.6 },
    );
  }

  // --- Contradiction aggregation -----------------------------------------
  const contradictionKeys: SignalKey[] = [
    'gps_country_mismatch',
    'timezone_mismatch',
    'mock_location_detected',
    'device_emulator_suspected',
    'device_compromised_suspected',
  ];
  if (!ipMismatchExplained) contradictionKeys.push('ip_country_mismatch');
  const contradictionCount = evidence.filter((e) => contradictionKeys.includes(e.key)).length;

  if (contradictionCount === 0 && gps && !mockDetected) {
    push(evidence, 'no_contradictions', 'CONSISTENCY', w.no_contradictions, 'All available signals are mutually consistent', {
      source: 'evidence_engine',
      capturedAt: nowIso,
      reliability: 1,
    });
  } else if (contradictionCount >= 2) {
    push(
      evidence,
      'contradictory_signals',
      'CONSISTENCY',
      w.contradictory_signals,
      `${contradictionCount} independent signals contradict each other`,
      { source: 'evidence_engine', capturedAt: nowIso, reliability: 1 },
    );
  }

  const rawScore = evidence.reduce((sum, e) => sum + e.contribution, 0);
  const confidence = Math.max(0, Math.min(100, Math.round(rawScore)));

  return {
    confidence,
    evidence,
    reasons: evidence.map((e) => e.reason),
  };
}
