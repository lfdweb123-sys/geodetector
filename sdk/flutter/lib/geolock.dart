import 'dart:convert';
import 'dart:io' show Platform;

import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:flutter/services.dart';

class GeoLockVerifyOptions {
  final String? requiredCountry;
  final bool requireLocation;
  final String sessionId;
  final Uri endpoint; // your own backend proxy - never embed the secret key in the app

  GeoLockVerifyOptions({
    this.requiredCountry,
    this.requireLocation = true,
    required this.sessionId,
    required this.endpoint,
  });
}

/// Native platform-channel bridge for signals `geolocator` cannot provide
/// (device integrity attestation). A real implementation wires this to the
/// Kotlin/Swift code in sdk/android and sdk/ios.
const _integrityChannel = MethodChannel('com.geolock.sdk/integrity');

class GeoLockClient {
  Future<bool> requestPermission() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.always || permission == LocationPermission.whileInUse;
  }

  Future<Position?> getCurrentFix() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return null;
    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.best),
      );
    } catch (_) {
      return null;
    }
  }

  /// Android: trusts the OS-reported mock flag. iOS: always UNAVAILABLE -
  /// there is no equivalent capability (see sdk/ios/README.md).
  String mockLocationStatus(Position? position) {
    if (position == null) return 'UNAVAILABLE';
    if (Platform.isAndroid) {
      return position.isMocked ? 'DETECTED' : 'NOT_DETECTED';
    }
    return 'UNAVAILABLE';
  }

  Future<String?> requestIntegrityToken(String nonce) async {
    try {
      final token = await _integrityChannel.invokeMethod<String>('requestToken', {'nonce': nonce});
      return token;
    } on PlatformException {
      return null;
    }
  }

  Future<Map<String, dynamic>> submitVerification(
    GeoLockVerifyOptions options,
    Position? position,
    String? integrityToken,
  ) async {
    final body = {
      'session_id': options.sessionId,
      if (options.requiredCountry != null) 'required_country': options.requiredCountry,
      'location': position == null
          ? null
          : {
              'latitude': position.latitude,
              'longitude': position.longitude,
              'accuracy': position.accuracy,
              'timestamp': position.timestamp.millisecondsSinceEpoch,
            },
      'device': {
        'mockLocationStatus': mockLocationStatus(position),
        'integrity': 'UNAVAILABLE',
        'integrityToken': integrityToken,
      },
    };

    final res = await http.post(
      options.endpoint,
      headers: {'content-type': 'application/json'},
      body: jsonEncode(body),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }
}
