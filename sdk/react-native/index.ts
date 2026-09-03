import { NativeModules, Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';

export interface GeoLockVerifyOptions {
  requiredCountry?: string;
  requireLocation?: boolean;
  sessionId: string;
  /** Your own backend proxy holding the GeoLock secret key. */
  endpoint: string;
}

// Expected native module shape - not bundled here, must be linked by a
// consuming app that implements it via the Kotlin/Swift reference code in
// sdk/android and sdk/ios.
interface GeoLockIntegrityModule {
  isMockLocation(): Promise<boolean | null>;
  requestIntegrityToken(nonce: string): Promise<string | null>;
}

const NativeIntegrity = NativeModules.GeoLockIntegrity as GeoLockIntegrityModule | undefined;

function getPosition(): Promise<Geolocation.GeoPosition | null> {
  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      (position) => resolve(position),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

export async function verify(options: GeoLockVerifyOptions) {
  const position = await getPosition();

  let mockLocationStatus: 'DETECTED' | 'NOT_DETECTED' | 'UNAVAILABLE' = 'UNAVAILABLE';
  if (Platform.OS === 'android' && NativeIntegrity) {
    const mocked = await NativeIntegrity.isMockLocation();
    if (mocked !== null) mockLocationStatus = mocked ? 'DETECTED' : 'NOT_DETECTED';
  }
  // iOS: intentionally left as UNAVAILABLE - no platform capability exists
  // to detect a simulated location on a real device (see sdk/ios/README.md).

  const integrityToken =
    NativeIntegrity && position ? await NativeIntegrity.requestIntegrityToken(options.sessionId) : null;

  const body = {
    session_id: options.sessionId,
    required_country: options.requiredCountry,
    location: position
      ? {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        }
      : null,
    device: {
      mockLocationStatus,
      integrity: 'UNAVAILABLE',
      integrityToken,
    },
  };

  const res = await fetch(options.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export const GeoLock = { verify };
export default GeoLock;
