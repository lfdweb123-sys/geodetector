# @geolock/web

Browser SDK for GeoLock multi-signal location verification.

## Install

Two ways to get the SDK into a page - pick whichever matches your stack.

**Any website, no build step (WordPress, static HTML, a page builder, a
`<script>` tag pasted into a CMS):**

```html
<script src="https://your-cdn-or-deployment/geolock.umd.js"></script>
<script>
  GeoLock.verify({ country: 'BJ', requireLocation: true }).then((result) => {
    if (result.location_verified) {
      // decision === 'ACCEPT'
    }
  });
</script>
```

Host `dist/geolock.umd.js` (built below) on your own static hosting/CDN
alongside your GeoLock deployment, or serve it from the deployment itself. It
attaches a single global, `window.GeoLock`, with the exact same `verify()`
API as the npm package - nothing else on `window` is touched.

**npm / a bundler (Next.js, Vite, webpack, Remix, plain React...):**

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

## Building

```bash
npm run build
```

Produces both `dist/index.js` (ES module, for `import`) and
`dist/geolock.umd.js` (a self-contained IIFE bundle for a plain `<script>`
tag - no bundler, no `type="module"` required).

## Beyond the browser

This SDK only covers browser-based websites. Anything else that can make an
HTTPS request - a native mobile app, a desktop application, a backend
service in any language, an embedded device - integrates the same detection
engine directly against the REST API (`POST /v1/verifications`), which is
plain JSON over HTTPS with no SDK dependency at all. See
`sdk/android`, `sdk/ios`, `sdk/flutter`, `sdk/react-native` for
platform-specific reference code, and the root README / `docs/openapi.yaml`
for the API itself.
