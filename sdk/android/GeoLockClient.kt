package com.geolock.sdk

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.os.Build
import androidx.core.content.ContextCompat
import android.Manifest
import android.content.pm.PackageManager
import com.google.android.gms.location.CurrentLocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityTokenRequest
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class GeoLockVerifyOptions(
    val requiredCountry: String? = null,
    val requireLocation: Boolean = true,
    val sessionId: String,
    val endpoint: String, // your backend proxy holding the GeoLock secret key
    val integrityCloudProjectNumber: Long, // from Google Play Console
)

/**
 * Reference implementation. Every method here documents the exact official
 * API it relies on - see README.md for what is and is not real detection.
 */
class GeoLockClient(private val context: Context) {

    fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    @SuppressLint("MissingPermission")
    suspend fun getCurrentFix(): Location? {
        if (!hasLocationPermission()) return null
        val client = LocationServices.getFusedLocationProviderClient(context)
        val request = CurrentLocationRequest.Builder()
            .setPriority(Priority.PRIORITY_HIGH_ACCURACY)
            .build()
        return suspendCancellableCoroutine { cont ->
            client.getCurrentLocation(request, null)
                .addOnSuccessListener { cont.resume(it) }
                .addOnFailureListener { cont.resume(null) }
        }
    }

    /**
     * True/false when the OS itself flags the fix as mocked. `null` means we
     * could not determine it (e.g. no fix) - callers must map that to
     * "UNAVAILABLE", never to "NOT_DETECTED".
     */
    fun isMockLocation(location: Location?): Boolean? {
        if (location == null) return null
        return if (Build.VERSION.SDK_INT >= 31) location.isMock else @Suppress("DEPRECATION") location.isFromMockProvider
    }

    /**
     * Requests a Play Integrity token bound to this verification's nonce.
     * GeoLock's backend decodes and verifies it server-side against Google's
     * Play Integrity verdict API - this client call only ever produces an
     * opaque token, never a verdict.
     */
    suspend fun requestIntegrityToken(nonce: String, cloudProjectNumber: Long): String? {
        val manager = IntegrityManagerFactory.create(context)
        val request = IntegrityTokenRequest.builder()
            .setNonce(nonce)
            .setCloudProjectNumber(cloudProjectNumber)
            .build()
        return suspendCancellableCoroutine { cont ->
            manager.requestIntegrityToken(request)
                .addOnSuccessListener { cont.resume(it.token()) }
                .addOnFailureListener { cont.resume(null) }
        }
    }

    /**
     * Sends the same verification payload shape as the Web SDK. `endpoint`
     * must be your own backend proxy - never embed the GeoLock secret key in
     * the app.
     */
    fun submitVerification(options: GeoLockVerifyOptions, location: Location?, mockDetected: Boolean?, integrityToken: String?): JSONObject {
        val body = JSONObject().apply {
            put("session_id", options.sessionId)
            options.requiredCountry?.let { put("required_country", it) }
            if (location != null) {
                put("location", JSONObject().apply {
                    put("latitude", location.latitude)
                    put("longitude", location.longitude)
                    put("accuracy", location.accuracy.toDouble())
                    put("timestamp", location.time)
                })
            } else {
                put("location", JSONObject.NULL)
            }
            put("device", JSONObject().apply {
                put(
                    "mockLocationStatus",
                    when (mockDetected) {
                        true -> "DETECTED"
                        false -> "NOT_DETECTED"
                        null -> "UNAVAILABLE"
                    },
                )
                // The final PHYSICAL/COMPROMISED_SUSPECTED verdict is derived
                // server-side from the Play Integrity token, not decided here.
                put("integrity", if (integrityToken != null) "UNAVAILABLE" else "UNAVAILABLE")
                put("integrityToken", integrityToken ?: JSONObject.NULL)
            })
        }

        val connection = URL(options.endpoint).openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.setRequestProperty("content-type", "application/json")
        connection.doOutput = true
        connection.outputStream.use { it.write(body.toString().toByteArray()) }
        val responseText = connection.inputStream.bufferedReader().readText()
        return JSONObject(responseText)
    }
}
