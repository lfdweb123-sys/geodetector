import type {
  Decision,
  MockLocationStatus,
  ProjectMode,
  ScoringResult,
  ScoringThresholds,
  VerificationStatus,
} from './types';

export interface DecisionInput {
  scoring: ScoringResult;
  thresholds: ScoringThresholds;
  mode: ProjectMode;
  requireLocation: boolean;
  locationProvided: boolean;
  permissionDenied: boolean;
  allowedCountries: string[];
  resolvedCountry?: string;
  mockLocationStatus: MockLocationStatus;
  deviceIntegrityAvailable: boolean;
  gpsAccuracyMeters?: number;
  maxAccuracyMeters: number;
}

export interface DecisionOutput {
  status: VerificationStatus;
  decision: Decision;
  reasons: string[];
}

function effectiveThresholds(mode: ProjectMode, thresholds: ScoringThresholds): ScoringThresholds {
  if (mode === 'STRICT' || mode === 'HIGH_SECURITY') {
    return {
      verifiedMin: Math.min(100, thresholds.verifiedMin + 10),
      suspiciousMin: Math.min(100, thresholds.suspiciousMin + 10),
    };
  }
  return thresholds;
}

function statusFromConfidence(confidence: number, thresholds: ScoringThresholds): VerificationStatus {
  if (confidence >= thresholds.verifiedMin) return 'VERIFIED';
  if (confidence >= thresholds.suspiciousMin) return 'SUSPICIOUS';
  return 'UNVERIFIED';
}

export function decide(input: DecisionInput): DecisionOutput {
  const reasons: string[] = [];

  if (input.requireLocation && !input.locationProvided) {
    reasons.push(input.permissionDenied ? 'LOCATION_PERMISSION_DENIED' : 'LOCATION_PERMISSION_REQUIRED');
    return { status: 'UNVERIFIED', decision: 'REJECT', reasons };
  }

  const thresholds = effectiveThresholds(input.mode, input.thresholds);
  const status = statusFromConfidence(input.scoring.confidence, thresholds);
  reasons.push(...input.scoring.reasons);

  const countryAllowed =
    input.allowedCountries.length === 0 ||
    (!!input.resolvedCountry && input.allowedCountries.includes(input.resolvedCountry));

  if (!countryAllowed) {
    reasons.push(
      input.resolvedCountry
        ? `Resolved country ${input.resolvedCountry} is not in the allowed list`
        : 'Location country could not be determined and an allowed-country policy is configured',
    );
    return { status, decision: 'REJECT', reasons };
  }

  if (input.mode === 'HIGH_SECURITY') {
    const gatePassed =
      input.locationProvided &&
      input.mockLocationStatus === 'NOT_DETECTED' &&
      input.deviceIntegrityAvailable &&
      input.gpsAccuracyMeters !== undefined &&
      input.gpsAccuracyMeters <= input.maxAccuracyMeters &&
      status === 'VERIFIED';

    if (!gatePassed) {
      reasons.push(
        'HIGH_SECURITY mode requires GPS, confirmed device integrity, no detected mock location, maximum accuracy and a VERIFIED score',
      );
      return { status, decision: 'REJECT', reasons };
    }
    return { status, decision: 'ACCEPT', reasons };
  }

  if (status === 'VERIFIED') return { status, decision: 'ACCEPT', reasons };
  if (status === 'SUSPICIOUS') return { status, decision: 'MANUAL_REVIEW', reasons };
  return { status, decision: 'REJECT', reasons };
}
