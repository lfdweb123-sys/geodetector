import type { GpsInput } from './types';

export interface GeocodedPlace {
  country?: string; // ISO 3166-1 alpha-2
  region?: string;
  city?: string;
}

const DEFAULT_REVERSE_GEOCODE_BASE_URL =
  process.env.REVERSE_GEOCODE_BASE_URL ?? 'https://api.bigdatacloud.net/data/reverse-geocode-client';

/**
 * Reverse-geocodes a GPS fix to country/region/city using BigDataCloud's free,
 * keyless client API. Real, network-backed lookup - never inferred by
 * eyeballing coordinate ranges. Returns `null` on failure so callers can
 * degrade confidence instead of guessing.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  baseUrl: string = DEFAULT_REVERSE_GEOCODE_BASE_URL,
): Promise<GeocodedPlace | null> {
  try {
    const res = await fetch(
      `${baseUrl}?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      countryCode?: string;
      principalSubdivision?: string;
      city?: string;
      locality?: string;
    };
    return {
      country: data.countryCode,
      region: data.principalSubdivision,
      city: data.city || data.locality,
    };
  } catch {
    return null;
  }
}

export function isGpsPrecise(gps: GpsInput, maxAccuracyMeters: number): boolean {
  return gps.accuracy > 0 && gps.accuracy <= maxAccuracyMeters;
}

export function isGpsRecent(gps: GpsInput, maxAgeSec: number, now: number = Date.now()): boolean {
  const ageSec = (now - gps.timestamp) / 1000;
  return ageSec >= 0 && ageSec <= maxAgeSec;
}

export function gpsAgeSeconds(gps: GpsInput, now: number = Date.now()): number {
  return Math.max(0, (now - gps.timestamp) / 1000);
}

/** Haversine distance in meters - used to flag jumps between consecutive fixes. */
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
