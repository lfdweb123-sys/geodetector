# GeoLock iOS SDK (reference scaffold)

Same philosophy as the Android scaffold: this documents exactly which
**official** Apple APIs back each signal.

## What is genuinely available on iOS

| Signal | Official API | Notes |
|---|---|---|
| GPS fix | `CoreLocation` (`CLLocationManager`) | Standard `NSLocationWhenInUseUsageDescription` permission flow. |
| Mock location detection | **None.** | Apple provides no public API to detect a simulated location on a real device. Jailbreak-based GPS spoofing tools exist and are not detectable client-side through any sanctioned API. `mockLocationStatus` must always be reported as `UNAVAILABLE` on iOS - claiming otherwise would violate the "never promise what you can't verify" principle this product is built on. |
| Device integrity / attestation | [DeviceCheck](https://developer.apple.com/documentation/devicecheck) / [App Attest](https://developer.apple.com/documentation/devicecheck/establishing_your_app_s_integrity) | Real, Apple-operated attestation that the app binary and device are genuine. Like Play Integrity, the token is opaque on-device and verified server-side against Apple's servers. |
| Simulator detection | `#if targetEnvironment(simulator)` (compile-time) or `ProcessInfo` environment checks | Only tells you the *build* is running in Xcode's Simulator, not whether a *location* is spoofed on a real device. Useful for QA, not for fraud signals. |

## What this scaffold implements

`GeoLockClient.swift` shows:
1. Requesting `whenInUse` authorization and a one-shot location fix.
2. Generating a DeviceCheck/App Attest key + assertion (App Attest, iOS 14+).
3. POSTing the same JSON shape as the other SDKs to your backend proxy.

`mockLocationStatus` is hardcoded to `"UNAVAILABLE"` throughout, intentionally.
