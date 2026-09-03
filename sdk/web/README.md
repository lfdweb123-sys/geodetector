# @geolock/web

Browser SDK for GeoLock multi-signal location verification.

## Install

```bash
npm install @geolock/web
```

## Quick start (recommended: server-side proxy)

Never put a secret GeoLock API key in browser code. Add a one-line proxy route
on your own backend that attaches the key server-side:

```ts
// Next.js app router: app/api/geolock/verify/route.ts
export async function POST(req: Request) {
  const res = await fetch('https://your-geolock-deployment.vercel.app/v1/verifications', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.GEOLOCK_SECRET_KEY}`,
    },
    body: await req.text(),
  });
  return new Response(await res.text(), { status: res.status });
}
```

Then in the browser:

```ts
import { GeoLock } from '@geolock/web';

const result = await GeoLock.verify({ country: 'BJ', requireLocation: true, maxAccuracy: 100 });

if (result.location_verified) {
  // decision === 'ACCEPT'
} else {
  // inspect result.status ('SUSPICIOUS' | 'UNVERIFIED'), result.reasons, result.error
}
```

## What this SDK does and does not do

- Checks for Geolocation API support before doing anything else.
- Shows a short consent explanation, then requests the browser's native
  permission prompt - it never tries to bypass or pre-empt that prompt.
- Only reads latitude/longitude/accuracy/timestamp - nothing else from the device.
- Always reports `mock_location: "UNAVAILABLE"` and device integrity as
  `UNAVAILABLE`: the Web Platform has no API for either, and this SDK will
  never claim a guarantee it cannot back up. Use the Android/iOS/Flutter/React
  Native SDKs for stronger device-level signals where the OS exposes them.

## Options

See `GeoLockVerifyOptions` in `src/index.ts` for the full list (country,
requireLocation, endpoint, apiBaseUrl/apiKey for advanced direct mode,
sessionId, showConsentUI, consentMessage, timeout).
