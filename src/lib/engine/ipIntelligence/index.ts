import { IpApiProvider } from './providers/ipapi';
import { IpInfoProvider } from './providers/ipinfo';
import { MockIpIntelligenceProvider } from './providers/mock';
import type { IpIntelligenceProvider } from './types';

export * from './types';
export { IpApiProvider, IpInfoProvider, MockIpIntelligenceProvider };

/**
 * Provider registry. Adding a new IP intelligence vendor means implementing
 * `IpIntelligenceProvider` and registering it here - nothing in the scoring
 * or decision engine depends on any specific vendor, by design (spec ยง7:
 * "prevoir une architecture permettant de brancher plusieurs fournisseurs").
 */
export function getIpIntelligenceProvider(name: string): IpIntelligenceProvider {
  switch (name) {
    case 'ipinfo': {
      const token = process.env.IPINFO_TOKEN;
      if (!token) {
        throw new Error('IPINFO_TOKEN is not configured but provider "ipinfo" was requested');
      }
      return new IpInfoProvider(token);
    }
    case 'mock':
      return new MockIpIntelligenceProvider();
    case 'ipapi':
    default:
      return new IpApiProvider();
  }
}
