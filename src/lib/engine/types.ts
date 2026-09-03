// Shared types for the GeoLock evidence / scoring / decision pipeline.
// Every signal that can influence a decision is modeled as `Evidence`: a typed,
// attributed, timestamped observation - never a bare boolean baked into logic.

export type SignalKey =
  | 'gps_precise'
  | 'gps_recent'
  | 'gps_country_match'
  | 'gps_imprecise'
  | 'gps_stale'
  | 'gps_missing'
  | 'gps_country_mismatch'
  | 'ip_consistent'
  | 'ip_explained_by_vpn'
  | 'ip_country_mismatch'
  | 'timezone_consistent'
  | 'timezone_mismatch'
  | 'language_consistent'
  | 'vpn_detected'
  | 'proxy_detected'
  | 'tor_detected'
  | 'datacenter_detected'
  | 'mock_location_detected'
  | 'mock_location_not_detected'
  | 'mock_location_unavailable'
  | 'device_physical'
  | 'device_emulator_suspected'
  | 'device_compromised_suspected'
  | 'no_contradictions'
  | 'contradictory_signals'
  | 'permission_denied';

export type EvidenceCategory =
  | 'GPS'
  | 'IP'
  | 'TIMEZONE'
  | 'LANGUAGE'
  | 'DEVICE'
  | 'MOCK_LOCATION'
  | 'CONSISTENCY';

/**
 * A single piece of proof feeding the decision engine.
 * `reliability` is how much we trust the *observation itself* (0-1),
 * independent of `weight` which is how much it should move the score.
 */
export interface Evidence {
  key: SignalKey;
  category: EvidenceCategory;
  value: unknown;
  reliability: number;
  source: string;
  capturedAt: string;
  weight: number;
  contribution: number;
  reason: string;
}

export type MockLocationStatus = 'DETECTED' | 'NOT_DETECTED' | 'UNAVAILABLE';
export type DeviceIntegrityStatus =
  | 'PHYSICAL'
  | 'EMULATOR_SUSPECTED'
  | 'COMPROMISED_SUSPECTED'
  | 'UNAVAILABLE';

export interface GpsInput {
  latitude: number;
  longitude: number;
  accuracy: number; // meters
  timestamp: number; // unix ms, client-reported fix time
  altitude?: number | null;
  speed?: number | null;
}

export interface ClientContext {
  timezone?: string;
  language?: string;
}

export interface DeviceSignals {
  mockLocationStatus?: MockLocationStatus;
  integrity?: DeviceIntegrityStatus;
}

export interface IpIntelligenceResult {
  ip: string;
  country?: string;
  region?: string;
  city?: string;
  asn?: string;
  isp?: string;
  vpn: boolean;
  proxy: boolean;
  tor: boolean;
  datacenter: boolean;
  confidence: number; // provider's own confidence in this classification, 0-1
  provider: string;
}

export interface ResolvedLocation {
  country?: string;
  region?: string;
  city?: string;
  source: 'gps' | 'ip' | 'none';
}

export interface ScoringWeights {
  gps_precise: number;
  gps_recent: number;
  gps_country_match: number;
  ip_consistent: number;
  timezone_consistent: number;
  language_consistent: number;
  device_physical: number;
  mock_location_not_detected: number;
  no_contradictions: number;

  gps_imprecise: number;
  gps_stale: number;
  gps_missing: number;
  gps_country_mismatch: number;
  ip_country_mismatch: number;
  timezone_mismatch: number;
  vpn_detected: number;
  proxy_detected: number;
  tor_detected: number;
  datacenter_detected: number;
  mock_location_detected: number;
  mock_location_unavailable: number;
  device_emulator_suspected: number;
  device_compromised_suspected: number;
  contradictory_signals: number;
}

export interface ScoringThresholds {
  verifiedMin: number;
  suspiciousMin: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  gps_precise: 30,
  gps_recent: 10,
  gps_country_match: 15,
  ip_consistent: 15,
  timezone_consistent: 5,
  language_consistent: 3,
  device_physical: 10,
  mock_location_not_detected: 7,
  no_contradictions: 5,

  gps_imprecise: -15,
  gps_stale: -15,
  gps_missing: -100,
  gps_country_mismatch: -25,
  ip_country_mismatch: -25,
  timezone_mismatch: -8,
  vpn_detected: -5,
  proxy_detected: -8,
  tor_detected: -25,
  datacenter_detected: -10,
  mock_location_detected: -50,
  mock_location_unavailable: -5,
  device_emulator_suspected: -20,
  device_compromised_suspected: -30,
  contradictory_signals: -20,
};

export const DEFAULT_THRESHOLDS: ScoringThresholds = {
  verifiedMin: 85,
  suspiciousMin: 40,
};

export type VerificationStatus = 'VERIFIED' | 'SUSPICIOUS' | 'UNVERIFIED';
export type Decision = 'ACCEPT' | 'REJECT' | 'MANUAL_REVIEW';
export type ProjectMode = 'STANDARD' | 'STRICT' | 'HIGH_SECURITY' | 'CUSTOM';

export interface ScoringResult {
  confidence: number;
  evidence: Evidence[];
  reasons: string[];
}

export interface DecisionResult {
  status: VerificationStatus;
  decision: Decision;
  reasons: string[];
  ruleTrace?: { ruleId: string; ruleName: string; action: string } | null;
}
