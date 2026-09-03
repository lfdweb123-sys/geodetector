import { describe, expect, it } from 'vitest';
import { isGpsPrecise, isGpsRecent, distanceMeters } from '@/lib/engine/gps';
import { isTimezonePlausibleForCountry, isLanguagePlausibleForCountry } from '@/lib/engine/consistency';

describe('GPS heuristics', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');

  it('flags precise vs imprecise fixes', () => {
    expect(isGpsPrecise({ latitude: 0, longitude: 0, accuracy: 20, timestamp: now }, 150)).toBe(true);
    expect(isGpsPrecise({ latitude: 0, longitude: 0, accuracy: 5000, timestamp: now }, 150)).toBe(false);
  });

  it('flags recent vs stale fixes', () => {
    expect(isGpsRecent({ latitude: 0, longitude: 0, accuracy: 20, timestamp: now }, 120, now)).toBe(true);
    expect(isGpsRecent({ latitude: 0, longitude: 0, accuracy: 20, timestamp: now - 10 * 60 * 1000 }, 120, now)).toBe(false);
  });

  it('computes a sane haversine distance', () => {
    const paris = { latitude: 48.8566, longitude: 2.3522 };
    const cotonou = { latitude: 6.3703, longitude: 2.3912 };
    const d = distanceMeters(paris, cotonou);
    expect(d).toBeGreaterThan(4_000_000);
    expect(d).toBeLessThan(6_000_000);
  });
});

describe('timezone/language plausibility', () => {
  it('matches a timezone to its real IANA country association', () => {
    expect(isTimezonePlausibleForCountry('Africa/Porto-Novo', 'BJ')).toBe(true);
    expect(isTimezonePlausibleForCountry('America/New_York', 'BJ')).toBe(false);
  });

  it('treats language-region subtags as a weak plausibility check', () => {
    expect(isLanguagePlausibleForCountry('fr-BJ', 'BJ')).toBe(true);
    expect(isLanguagePlausibleForCountry('en-US', 'BJ')).toBe(false);
    expect(isLanguagePlausibleForCountry('fr', 'BJ')).toBe(true); // no region subtag - can't contradict
  });
});
