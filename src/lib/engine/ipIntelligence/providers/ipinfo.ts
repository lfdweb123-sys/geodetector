import type { IpIntelligenceResult } from '../../types';
import { IpIntelligenceError } from '../types';

/**
 * ipinfo.io - requires an API token (https://ipinfo.io/signup). On plans that
 * include "Privacy Detection" the API returns a `privacy` object with
 * distinct `vpn`, `proxy`, `tor`, `relay` and `hosting` booleans, which is
 * real, separately-sourced VPN/proxy/Tor classification (not derived from a
 * single combined flag). Without that add-on the `privacy` object is absent
 * and we honestly report reduced confidence rather than fabricating a split.
 */
export class IpInfoProvider {
  readonly name = 'ipinfo';

  constructor(private readonly token: string) {}

  async lookup(ip: string): Promise<IpIntelligenceResult> {
    let res: Response;
    try {
      res = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}?token=${this.token}`, {
        cache: 'no-store',
      });
    } catch (err) {
      throw new IpIntelligenceError(`network error: ${(err as Error).message}`, this.name);
    }

    if (!res.ok) {
      throw new IpIntelligenceError(`HTTP ${res.status}`, this.name);
    }

    const data = (await res.json()) as {
      ip: string;
      country?: string;
      region?: string;
      city?: string;
      asn?: { asn?: string; name?: string };
      org?: string;
      privacy?: { vpn?: boolean; proxy?: boolean; tor?: boolean; relay?: boolean; hosting?: boolean };
    };

    const hasPrivacyData = Boolean(data.privacy);

    return {
      ip: data.ip ?? ip,
      country: data.country,
      region: data.region,
      city: data.city,
      asn: data.asn?.asn,
      isp: data.asn?.name ?? data.org,
      vpn: Boolean(data.privacy?.vpn),
      proxy: Boolean(data.privacy?.proxy) || Boolean(data.privacy?.relay),
      tor: Boolean(data.privacy?.tor),
      datacenter: Boolean(data.privacy?.hosting),
      confidence: hasPrivacyData ? 0.95 : 0.5,
      provider: this.name,
    };
  }
}
