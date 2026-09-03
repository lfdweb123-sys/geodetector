# GeoLock

Multi-signal location verification platform. GeoLock combines GPS, IP
intelligence, timezone/language context and (where the OS genuinely exposes
them) device-integrity signals into an explainable confidence score,
detecting incoherences such as VPN/proxy/Tor/datacenter routing, simulated
GPS, or contradictory timezone/IP/GPS combinations - without ever asserting a
user's location with absolute certainty. Every result carries a confidence
score, evidence trail and human-readable reasons.

Read `docs/ARCHITECTURE.md` first - it explains exactly what is and is not
technically possible, and why the scoring model is built the way it is.
`docs/SECURITY.md` and `docs/PRIVACY.md` cover the security model and
privacy-by-design choices.

## Integrating anywhere

The core API (`POST /v1/verifications`) is plain JSON over HTTPS with no
SDK dependency, so anything capable of an HTTPS request can integrate
directly: a website, a native mobile app, a desktop application, a backend
service in any language, an embedded/IoT device. On top of that universal
path, GeoLock ships:

- `sdk/web` - a browser SDK available both as an npm package (`@geolock/web`)
  and as a self-contained `<script>`-tag bundle (`dist/geolock.umd.js`,
  built by `npm run sdk:build`) for sites with no build step at all -
  WordPress, a static HTML page, a page builder, a CMS snippet.
- `sdk/android`, `sdk/ios`, `sdk/flutter`, `sdk/react-native` - reference
  scaffolds for native mobile apps, documenting exactly which official
  platform APIs back each signal.
- The dashboard's **SDK & Tests** page shows ready-to-copy snippets for the
  Web SDK, the script tag, curl, Python and PHP.

## Project layout

```
prisma/schema.prisma        Multi-tenant data model (orgs, projects, keys, rules, verifications, webhooks, usage, audit log)
src/lib/engine/             The detection core: IP intelligence, GPS, consistency checks, scoring, decision, rules engine
src/lib/security/           API keys, HMAC request signing, anti-replay, rate limiting, verification tokens
src/app/api/v1/             Public REST API (verifications, projects, api-keys, usage, rules, webhooks)
src/app/dashboard/          SaaS dashboard (Next.js App Router, server actions)
sdk/web/                    Browser SDK (@geolock/web)
sdk/android, sdk/ios,
sdk/flutter, sdk/react-native  Reference native SDK scaffolds with an honest capability matrix per platform
tests/                      Vitest suite covering the scenarios in docs/ARCHITECTURE.md
docs/                       OpenAPI spec, architecture, security, privacy
```

## Local development

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL at minimum
npx prisma migrate dev      # creates tables in your Postgres database
npm run dev
```

Open http://localhost:3000, create an account (this creates your
organization), create a project, create an API key, then either:
- use the dashboard's **SDK → Live playground** to run real verifications
  against live IP intelligence + reverse geocoding, or
- `POST` directly to `/v1/verifications` with `Authorization: Bearer <key>`.

Run the test suite:

```bash
npm test
```

## Deploying to Vercel

1. Push this repository to GitHub (or your Git provider of choice) and
   import it in Vercel.
2. Provision a Postgres database (Vercel Postgres, Neon, or Supabase all
   work unmodified) and set `DATABASE_URL` in the Vercel project's
   environment variables.
3. Set `NEXTAUTH_URL` to your production URL and `NEXTAUTH_SECRET` /
   `VERIFICATION_TOKEN_SECRET` to freshly generated secrets
   (`openssl rand -base64 32`).
4. Optionally provision Upstash Redis (free tier is enough to start) and set
   `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` - this makes rate
   limiting and anti-replay correct across all serverless instances instead
   of falling back to a single-instance in-memory store.
5. Optionally set `IPINFO_TOKEN` and `IP_INTEL_PROVIDER=ipinfo` for stronger
   VPN/proxy/Tor/hosting classification (see `docs/ARCHITECTURE.md` ยง1); the
   default `ipapi` provider needs no key.
6. Add a build step to run database migrations
   (`npx prisma migrate deploy`) either as part of your CI pipeline before
   deploying, or by adding it to the Vercel project's build command
   (`prisma generate && prisma migrate deploy && next build`).
7. Deploy. The dashboard, REST API and webhooks all ship from the same
   deployment - there is nothing else to stand up.

## What is implemented vs. reference-only in this build

Fully implemented and tested: the evidence/scoring/decision/rules pipeline,
real IP intelligence (ip-api.com by default, ipinfo.io pluggable), real Tor
exit-node detection, real reverse geocoding, the REST API, the dashboard
(projects, API keys, rules, webhooks, scoring weights, usage, audit logs,
billing plan display), the Web SDK, and the security layer (hashed keys,
HMAC signing, anti-replay, rate limiting, RBAC, audit log).

Reference scaffolds, not shippable packages: the Android/iOS/Flutter/React
Native SDKs (`sdk/android`, `sdk/ios`, `sdk/flutter`, `sdk/react-native`)
document the exact official platform APIs a full native SDK would call
(FusedLocationProviderClient, `Location.isMock()`, Play Integrity, CoreLocation,
App Attest) and show real call shapes, but are not published, compiled
packages - see each directory's README for what is genuinely available on
that platform and what is not (notably: iOS has no public API to detect a
simulated location on a real device, ever).

Payment processing (Stripe or similar) is not wired up - the Billing page
displays plans and usage against quota but does not process real charges.
