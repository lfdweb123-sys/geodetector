# GeoLock Flutter SDK (reference scaffold)

Built on top of the [`geolocator`](https://pub.dev/packages/geolocator)
package, which wraps `FusedLocationProviderClient` on Android and
`CoreLocation` on iOS - the same official APIs the native scaffolds use
directly.

## Mock location detection caveat

`geolocator`'s `Position.isMocked` is backed by `Location.isFromMockProvider()`
**on Android only**. On iOS the package has no equivalent capability and the
field is not a real signal there. This SDK therefore:

- Trusts `position.isMocked` on Android (`Platform.isAndroid`).
- Always reports `UNAVAILABLE` on iOS, regardless of what any package field
  says, for the same reason documented in `sdk/ios/README.md`.

## Device integrity

Not provided by `geolocator`. A real implementation needs a platform channel
down to Play Integrity (Android) / App Attest (iOS) - see `lib/geolock.dart`
for the channel method signature this scaffold expects a native
implementation to provide; the native side would reuse the exact code in
`sdk/android/GeoLockClient.kt` and `sdk/ios/GeoLockClient.swift`.
