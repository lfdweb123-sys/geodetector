import CoreLocation
import DeviceCheck
import Foundation

struct GeoLockVerifyOptions {
    let requiredCountry: String?
    let requireLocation: Bool
    let sessionId: String
    /// Your own backend proxy holding the GeoLock secret key - never embed it in the app.
    let endpoint: URL
}

/// Reference implementation - see README.md for exactly which signals are
/// real Apple APIs versus permanently unavailable on this platform.
final class GeoLockClient: NSObject, CLLocationManagerDelegate {
    private let locationManager = CLLocationManager()
    private var continuation: CheckedContinuation<CLLocation?, Never>?

    func requestAuthorization() {
        locationManager.requestWhenInUseAuthorization()
    }

    func getCurrentFix() async -> CLLocation? {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        return await withCheckedContinuation { cont in
            self.continuation = cont
            self.locationManager.requestLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        continuation?.resume(returning: locations.first)
        continuation = nil
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        continuation?.resume(returning: nil)
        continuation = nil
    }

    /// App Attest key generation + assertion. The resulting token is opaque
    /// to this app - GeoLock's backend verifies it against Apple's servers.
    func requestAppAttestAssertion(clientDataHash: Data) async -> String? {
        guard DCAppAttestService.shared.isSupported else { return nil }
        do {
            let keyId = try await DCAppAttestService.shared.generateKey()
            let assertion = try await DCAppAttestService.shared.generateAssertion(keyId, clientDataHash: clientDataHash)
            return assertion.base64EncodedString()
        } catch {
            return nil
        }
    }

    func submitVerification(
        options: GeoLockVerifyOptions,
        location: CLLocation?,
        attestation: String?
    ) async throws -> [String: Any] {
        var body: [String: Any] = [
            "session_id": options.sessionId,
            "device": [
                // No public API can confirm or deny a simulated location on a
                // real iOS device - this is always UNAVAILABLE, not a guess.
                "mockLocationStatus": "UNAVAILABLE",
                "integrity": "UNAVAILABLE",
                "attestationToken": attestation as Any,
            ],
        ]
        if let country = options.requiredCountry {
            body["required_country"] = country
        }
        if let location {
            body["location"] = [
                "latitude": location.coordinate.latitude,
                "longitude": location.coordinate.longitude,
                "accuracy": location.horizontalAccuracy,
                "timestamp": Int(location.timestamp.timeIntervalSince1970 * 1000),
            ]
        } else {
            body["location"] = NSNull()
        }

        var request = URLRequest(url: options.endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, _) = try await URLSession.shared.data(for: request)
        return (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }
}
