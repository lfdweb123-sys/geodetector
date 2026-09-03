import type { IpIntelligenceResult } from '../../types';

/**
 * Deterministic, offline provider. Used in local dev without any external
 * dependency, and injected directly in unit tests so scoring tests never
 * depend on network state. Never used in production.
 */
export class MockIpIntelligenceProvider {
  readonly name = 'mock';

  constructor(private readonly fixed: Partial<IpIntelligenceResult> = {}) {}

  async lookup(ip: string): Promise<IpIntelligenceResult> {
    return {
      ip,
      country: 'BJ',
      region: undefined,
      city: undefined,
      asn: 'AS0000',
      isp: 'Mock ISP',
      vpn: false,
      proxy: false,
      tor: false,
      datacenter: false,
      confidence: 0.5,
      provider: this.name,
      ...this.fixed,
    };
  }
}
