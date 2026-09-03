import { describe, expect, it } from 'vitest';
import { runVerificationPipeline } from '@/lib/engine/pipeline';
import { fakeGeocode, fakeIpProvider, testProjectConfig } from './helpers';

const NOW = Date.parse('2026-01-01T12:00:00Z');

const BJ_GPS = { latitude: 6.3703, longitude: 2.3912, accuracy: 18, timestamp: NOW };

describe('verification pipeline', () => {
  it('normal case: GPS and IP concordant -> VERIFIED / ACCEPT with high confidence', async () => {
    const result = await runVerificationPipeline(
      {
        sessionId: 's1',
        requiredCountry: 'BJ',
        location: BJ_GPS,
        client: { timezone: 'Africa/Porto-Novo', language: 'fr-BJ' },
        device: { mockLocationStatus: 'NOT_DETECTED', integrity: 'PHYSICAL' },
        ip: '1.2.3.4',
      },
      testProjectConfig(),
      {
        ipProvider: fakeIpProvider({ country: 'BJ', vpn: false, proxy: false, tor: false, datacenter: false }),
        reverseGeocode: fakeGeocode({ country: 'BJ', city: 'Cotonou' }),
        now: NOW,
      },
    );

    expect(result.status).toBe('VERIFIED');
    expect(result.decision).toBe('ACCEPT');
    expect(result.confidence).toBeGreaterThanOrEqual(90);
    expect(result.mockLocationStatus).toBe('NOT_DETECTED');
  });

  it('VPN scenario: GPS Benin + IP France + VPN -> still VERIFIED / ACCEPT (VPN explains the IP mismatch)', async () => {
    const result = await runVerificationPipeline(
      {
        sessionId: 's2',
        requiredCountry: 'BJ',
        location: BJ_GPS,
        client: { timezone: 'Africa/Porto-Novo', language: 'fr-BJ' },
        device: { mockLocationStatus: 'NOT_DETECTED', integrity: 'PHYSICAL' },
        ip: '5.6.7.8',
      },
      testProjectConfig(),
      {
        ipProvider: fakeIpProvider({ country: 'FR', vpn: true, proxy: false, tor: false, datacenter: false }),
        reverseGeocode: fakeGeocode({ country: 'BJ', city: 'Cotonou' }),
        now: NOW,
      },
    );

    expect(result.status).toBe('VERIFIED');
    expect(result.decision).toBe('ACCEPT');
    expect(result.confidence).toBeGreaterThanOrEqual(85);
    const ipEvidence = result.evidence.find((e) => e.key === 'ip_explained_by_vpn');
    expect(ipEvidence).toBeDefined();
  });

  it('proxy scenario: GPS Benin + proxy -> generally still acceptable', async () => {
    const result = await runVerificationPipeline(
      {
        sessionId: 's3',
        requiredCountry: 'BJ',
        location: BJ_GPS,
        client: { timezone: 'Africa/Porto-Novo' },
        device: { mockLocationStatus: 'NOT_DETECTED', integrity: 'PHYSICAL' },
        ip: '9.9.9.9',
      },
      testProjectConfig(),
      {
        ipProvider: fakeIpProvider({ country: 'DE', vpn: false, proxy: true, tor: false, datacenter: false }),
        reverseGeocode: fakeGeocode({ country: 'BJ', city: 'Cotonou' }),
        now: NOW,
      },
    );

    expect(result.decision).toBe('ACCEPT');
    expect(result.evidence.some((e) => e.key === 'proxy_detected')).toBe(true);
  });

  it('Tor scenario: heavier penalty than VPN', async () => {
    const vpnResult = await runVerificationPipeline(
      {
        sessionId: 's4a',
        requiredCountry: 'BJ',
        location: BJ_GPS,
        device: { mockLocationStatus: 'NOT_DETECTED', integrity: 'PHYSICAL' },
        ip: '1.1.1.1',
      },
      testProjectConfig(),
      {
        ipProvider: fakeIpProvider({ country: 'FR', vpn: true }),
        reverseGeocode: fakeGeocode({ country: 'BJ' }),
        now: NOW,
      },
    );

    const torResult = await runVerificationPipeline(
      {
        sessionId: 's4b',
        requiredCountry: 'BJ',
        location: BJ_GPS,
        device: { mockLocationStatus: 'NOT_DETECTED', integrity: 'PHYSICAL' },
        ip: '2.2.2.2',
      },
      testProjectConfig(),
      {
        ipProvider: fakeIpProvider({ country: 'FR', tor: true }),
        reverseGeocode: fakeGeocode({ country: 'BJ' }),
        now: NOW,
      },
    );

    expect(torResult.confidence).toBeLessThan(vpnResult.confidence);
    expect(torResult.evidence.some((e) => e.key === 'tor_detected')).toBe(true);
  });

  it('datacenter IP reduces confidence relative to a clean baseline', async () => {
    const clean = await runVerificationPipeline(
      {
        sessionId: 's5a',
        requiredCountry: 'BJ',
        location: BJ_GPS,
        device: { mockLocationStatus: 'NOT_DETECTED', integrity: 'PHYSICAL' },
        ip: '3.3.3.3',
      },
      testProjectConfig(),
      { ipProvider: fakeIpProvider({ country: 'BJ' }), reverseGeocode: fakeGeocode({ country: 'BJ' }), now: NOW },
    );

    const datacenter = await runVerificationPipeline(
      {
        sessionId: 's5b',
        requiredCountry: 'BJ',
        location: BJ_GPS,
        device: { mockLocationStatus: 'NOT_DETECTED', integrity: 'PHYSICAL' },
        ip: '4.4.4.4',
      },
      testProjectConfig(),
      {
        ipProvider: fakeIpProvider({ country: 'BJ', datacenter: true }),
        reverseGeocode: fakeGeocode({ country: 'BJ' }),
        now: NOW,
      },
    );

    expect(datacenter.confidence).toBeLessThan(clean.confidence);
  });

  it('mock location detected -> UNVERIFIED / REJECT with very low confidence', async () => {
    const result = await runVerificationPipeline(
      {
        sessionId: 's6',
        requiredCountry: 'BJ',
        location: BJ_GPS,
        client: { timezone: 'America/New_York' },
        device: { mockLocationStatus: 'DETECTED', integrity: 'EMULATOR_SUSPECTED' },
        ip: '8.8.8.8',
      },
      testProjectConfig(),
      {
        ipProvider: fakeIpProvider({ country: 'DE', vpn: true }),
        reverseGeocode: fakeGeocode({ country: 'BJ' }),
        now: NOW,
      },
    );

    expect(result.status).toBe('UNVERIFIED');
    expect(result.decision).toBe('REJECT');
    expect(result.confidence).toBeLessThan(40);
  });

  it('location permission denied with requireLocation -> UNVERIFIED / REJECT / LOCATION_PERMISSION_DENIED', async () => {
    const result = await runVerificationPipeline(
      {
        sessionId: 's7',
        requiredCountry: 'BJ',
        location: null,
        locationPermissionDenied: true,
        ip: '1.2.3.4',
      },
      testProjectConfig({ requireLocation: true }),
      { ipProvider: fakeIpProvider({ country: 'BJ' }), reverseGeocode: fakeGeocode(null), now: NOW },
    );

    expect(result.status).toBe('UNVERIFIED');
    expect(result.decision).toBe('REJECT');
    expect(result.reasons).toContain('LOCATION_PERMISSION_DENIED');
  });

  it('imprecise GPS reduces confidence and is flagged', async () => {
    const result = await runVerificationPipeline(
      {
        sessionId: 's8',
        requiredCountry: 'BJ',
        location: { ...BJ_GPS, accuracy: 5000 },
        device: { mockLocationStatus: 'NOT_DETECTED', integrity: 'PHYSICAL' },
        ip: '1.2.3.4',
      },
      testProjectConfig(),
      { ipProvider: fakeIpProvider({ country: 'BJ' }), reverseGeocode: fakeGeocode({ country: 'BJ' }), now: NOW },
    );

    expect(result.evidence.some((e) => e.key === 'gps_imprecise')).toBe(true);
  });

  it('stale GPS fix is flagged and penalized', async () => {
    const result = await runVerificationPipeline(
      {
        sessionId: 's9',
        requiredCountry: 'BJ',
        location: { ...BJ_GPS, timestamp: NOW - 10 * 60 * 1000 },
        device: { mockLocationStatus: 'NOT_DETECTED', integrity: 'PHYSICAL' },
        ip: '1.2.3.4',
      },
      testProjectConfig(),
      { ipProvider: fakeIpProvider({ country: 'BJ' }), reverseGeocode: fakeGeocode({ country: 'BJ' }), now: NOW },
    );

    expect(result.evidence.some((e) => e.key === 'gps_stale')).toBe(true);
  });

  it('contradictory signals: GPS Benin + timezone USA + IP USA (no VPN) -> low confidence, not ACCEPT', async () => {
    const result = await runVerificationPipeline(
      {
        sessionId: 's10',
        requiredCountry: 'BJ',
        location: BJ_GPS,
        client: { timezone: 'America/New_York' },
        device: { mockLocationStatus: 'NOT_DETECTED', integrity: 'PHYSICAL' },
        ip: '1.2.3.4',
      },
      testProjectConfig(),
      {
        ipProvider: fakeIpProvider({ country: 'US', vpn: false, proxy: false, tor: false, datacenter: false }),
        reverseGeocode: fakeGeocode({ country: 'BJ' }),
        now: NOW,
      },
    );

    expect(result.evidence.some((e) => e.key === 'ip_country_mismatch')).toBe(true);
    expect(result.evidence.some((e) => e.key === 'timezone_mismatch')).toBe(true);
    expect(result.decision).not.toBe('ACCEPT');
  });

  it('allowed-country gate rejects a confidently-resolved but disallowed country', async () => {
    const result = await runVerificationPipeline(
      {
        sessionId: 's11',
        location: { latitude: 48.8566, longitude: 2.3522, accuracy: 10, timestamp: NOW },
        device: { mockLocationStatus: 'NOT_DETECTED', integrity: 'PHYSICAL' },
        client: { timezone: 'Europe/Paris' },
        ip: '1.2.3.4',
      },
      testProjectConfig({ allowedCountries: ['BJ'] }),
      { ipProvider: fakeIpProvider({ country: 'FR' }), reverseGeocode: fakeGeocode({ country: 'FR' }), now: NOW },
    );

    expect(result.decision).toBe('REJECT');
  });

  it('HIGH_SECURITY mode rejects when device integrity is unavailable even with a high score', async () => {
    const result = await runVerificationPipeline(
      {
        sessionId: 's12',
        requiredCountry: 'BJ',
        location: BJ_GPS,
        client: { timezone: 'Africa/Porto-Novo', language: 'fr-BJ' },
        device: { mockLocationStatus: 'NOT_DETECTED' },
        ip: '1.2.3.4',
      },
      testProjectConfig({ mode: 'HIGH_SECURITY' }),
      { ipProvider: fakeIpProvider({ country: 'BJ' }), reverseGeocode: fakeGeocode({ country: 'BJ' }), now: NOW },
    );

    expect(result.decision).toBe('REJECT');
  });

  it('rules engine can override the base decision (BLOCK on non-required country)', async () => {
    const result = await runVerificationPipeline(
      {
        sessionId: 's13',
        requiredCountry: 'BJ',
        location: { latitude: 48.8566, longitude: 2.3522, accuracy: 10, timestamp: NOW },
        device: { mockLocationStatus: 'NOT_DETECTED', integrity: 'PHYSICAL' },
        ip: '1.2.3.4',
      },
      testProjectConfig(),
      {
        ipProvider: fakeIpProvider({ country: 'FR' }),
        reverseGeocode: fakeGeocode({ country: 'FR' }),
        now: NOW,
        rules: [
          {
            id: 'r1',
            name: 'Block non-BJ',
            condition: { field: 'country', op: 'ne', value: 'BJ' },
            action: 'BLOCK',
            priority: 10,
            enabled: true,
          },
        ],
      },
    );

    expect(result.decision).toBe('REJECT');
    expect(result.ruleTrace?.ruleName).toBe('Block non-BJ');
  });
});
