# GeoLock React Native SDK (reference scaffold)

Uses [`react-native-geolocation-service`](https://github.com/Agontuk/react-native-geolocation-service)
(a maintained wrapper around `FusedLocationProviderClient` / `CoreLocation` -
the same official platform APIs as the native scaffolds) for the GPS fix.

## Mock location & device integrity

Neither is exposed by any JS-level geolocation package. This scaffold expects
a small native module (`GeoLockIntegrity`) exposing two methods that a real
release would implement by reusing the exact native code already written in
`sdk/android/GeoLockClient.kt` (Play Integrity + `Location.isMock()`) and
`sdk/ios/GeoLockClient.swift` (App Attest; mock detection permanently
`UNAVAILABLE` on iOS - see that README for why). `index.ts` calls through
`NativeModules.GeoLockIntegrity` and degrades to `"UNAVAILABLE"` if the
native module isn't linked, rather than guessing.
