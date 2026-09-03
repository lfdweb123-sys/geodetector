import type { IpIntelligenceResult } from '../../types';
import { IpIntelligenceError } from '../types';
import { isTorExitNode } from '../torExitList';

/**
 * ip-api.com - free tier, no API key required, HTTP only on the free plan.
 * Real service, documented at https://ip-api.com/docs/api:json
 *
 * The free tier reports a single combined `proxy` flag ("proxy, VPN, or Tor
 * exit address") plus a `hosting` flag (datacenter / cloud ranges). It does
 * NOT let us tell VPN, proxy and Tor apart on its own - so we cross-check the
 * IP against the Tor Project's official exit-node list to split Tor out, and
 * report the remainder under both `vpn` and `proxy` (deliberately
 * conservative: we surface the ambiguity to the caller via `confidence`
 * rather than pretending to a distinction the data doesn't support).
 */
export class IpApiProvider {
  readonly name = 'ipapi';

  async lookup(ip: string): Promise<IpIntelligenceResult> {
    const fields = [
      'status',
      'message',
      'country',
      'countryCode',
      'regionName',
      'city',
      'isp',
      'org',
      'as',
      'proxy',
      'hosting',
      'query',
    ].join(',');

    let res: Response;
    try {
      res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${fields}`, {
        cache: 'no-store',
      });
    } catch (err) {
      throw new IpIntelligenceError(`network error: ${(err as Error).message}`, this.name);
    }

    if (!res.ok) {
      throw new IpIntelligenceError(`HTTP ${res.status}`, this.name);
    }

    const data = (await res.json()) as {
      status: string;
      message?: string;
      country?: string;
      countryCode?: string;
      regionName?: string;
      city?: string;
      isp?: string;
      as?: string;
      proxy?: boolean;
      hosting?: boolean;
      query?: string;
    };

    if (data.status !== 'success') {
      throw new IpIntelligenceError(data.message ?? 'lookup failed', this.name);
    }

    const tor = await isTorExitNode(ip);
    const anonymized = Boolean(data.proxy);

    return {
      ip,
      country: data.countryCode,
      region: data.regionName,
      city: data.city,
      asn: data.as,
      isp: data.isp,
      // ip-api can't distinguish VPN from generic proxy - both surface as `proxy`.
      vpn: anonymized && !tor,
      proxy: anonymized && !tor,
      tor: tor === true,
      datacenter: Boolean(data.hosting),
      // Lower confidence when Tor status was unknowable (network failure on the
      // exit-list fetch) since that ambiguity feeds directly into vpn/proxy/tor.
      confidence: tor === undefined ? 0.6 : 0.8,
      provider: this.name,
    };
  }
}
