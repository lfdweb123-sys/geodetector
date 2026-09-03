# GeoLock Android SDK (reference scaffold)

This directory is a reference implementation, not a published Gradle module -
it shows exactly which **official** Android APIs back each signal, so an
integrator (or a future full SDK release) knows precisely what is real and
what is not.

## What is genuinely available on Android

| Signal | Official API | Notes |
|---|---|---|
| GPS fix | `FusedLocationProviderClient` (Google Play services) or `LocationManager` | Standard permission flow: `ACCESS_FINE_LOCATION`. |
| Mock location detection | `Location.isMock()` (API 31+) / `Location.isFromMockProvider()` (deprecated but functional back to API 18) | Flags a location as coming from a mock provider **the OS is aware of**. A sufficiently sophisticated attack (rooted device replacing the location HAL) can defeat this - report `DETECTED` / `NOT_DETECTED` accordingly, never claim certainty. |
| Device integrity | [Play Integrity API](https://developer.android.com/google/play/integrity) | Real, Google-operated attestation of device/app integrity (replaces SafetyNet Attestation, which is deprecated). Requires a server-side verdict check against Google's servers - the client only requests a token. |
| Root/emulator heuristics | No single official API; combination of `Build.FINGERPRINT`, `Build.MODEL`, presence of known emulator files, etc. | Heuristic only, explicitly weaker than Play Integrity - use as a secondary signal, not primary. |

## What this scaffold implements

`GeoLockClient.kt` shows the real call shapes for:
1. Requesting `ACCESS_FINE_LOCATION` at runtime.
2. Getting a single high-accuracy fix via `FusedLocationProviderClient`.
3. Reading `Location.isMock()` / `isFromMockProvider()`.
4. Requesting a Play Integrity token (verification of the token happens on
   GeoLock's backend, which calls Google's Play Integrity verdict API - the
   app never verifies its own integrity token).
5. POSTing the same JSON shape the Web SDK sends to `/v1/verifications`.

## Not included in this scaffold

A publishable `.aar`, Gradle build files, and Play Integrity server-side
verdict decoding (that belongs in the GeoLock backend, not the client SDK).
Treat this as the technical spec for a full native SDK, not a finished
library - shipping it as a real Maven artifact is future work.
