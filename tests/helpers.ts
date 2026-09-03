import type { IpIntelligenceProvider } from '@/lib/engine/ipIntelligence/types';
import type { IpIntelligenceResult, ProjectMode, ScoringThresholds, ScoringWeights } from '@/lib/engine/types';
import { DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS } from '@/lib/engine/types';
import type { ProjectConfig } from '@/lib/engine/pipeline';
import type { GeocodedPlace } from '@/lib/engine/gps';

export function fakeIpProvider(result: Partial<IpIntelligenceResult>): IpIntelligenceProvider {
  return {
    name: 'fake',
    async lookup(ip: string): Promise<IpIntelligenceResult> {
      return {
        ip,
        country: 'BJ',
        vpn: false,
        proxy: false,
        tor: false,
        datacenter: false,
        confidence: 0.9,
        provider: 'fake',
        ...result,
      };
    },
  };
}

export function fakeGeocode(place: GeocodedPlace | null) {
  return async () => place;
}

export function testProjectConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    mode: 'STANDARD' as ProjectMode,
    requireLocation: true,
    allowedCountries: [],
    maxAccuracyMeters: 150,
    maxLocationAgeSec: 120,
    weights: DEFAULT_WEIGHTS as ScoringWeights,
    thresholds: DEFAULT_THRESHOLDS as ScoringThresholds,
    ...overrides,
  };
}
