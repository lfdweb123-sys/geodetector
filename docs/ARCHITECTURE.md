# GeoLock — Architecture &amp; Design Rationale

## 1. What is technically possible, and what is not

GeoLock's entire design rests on one constraint that no vendor can honestly
engineer around: **there is no server-side API that proves where a device
physically is.** Everything GeoLock does is combine several independently
falsifiable signals and reason about how well they corroborate each other.
Concretely:

| Claim | Possible? | Why |
|---|---|---|
| "We know the user is in country X with 100% certainty" | **No** | Every signal (GPS, IP, timezone) can be spoofed or misconfigured by a sufficiently motivated user, and GeoLock only ever sees what the OS/browser chooses to report. |
| "We can always detect a mocked GPS location" | **No** | Android exposes `Location.isMock()`/`isFromMockProvider()`, which a rooted device replacing the location HAL can defeat. iOS exposes **nothing** - mock detection is unconditionally `UNAVAILABLE` there. |
| "We can always detect an emulator or compromised device" | **No** | Play Integrity (Android) and App Attest (iOS) give real, cryptographically backed verdicts *when the OS and Play Services / Apple's servers are reachable and the app integrates them*; without that integration (e.g. the plain Web SDK), device integrity is `UNAVAILABLE`, full stop. |
| "We can tell VPN, proxy and Tor apart with certainty" | **Partially** | Tor is verifiable against the Tor Project's own exit-node list (ground truth). VPN vs. generic proxy is a best-effort classification from IP intelligence vendors and is never 100% precise - see `docs/SECURITY.md` for how GeoLock is built to plug in better vendors without changing the rest of the system. |
| "A user who declines location sharing can still be geolocated precisely" | **No, and GeoLock will not try.** | If location permission is denied, the result is `UNVERIFIED` / `LOCATION_PERMISSION_REQUIRED` or `_DENIED`, never a silent IP-only guess presented as GPS-grade. |

Because of this, **every GeoLock response carries a confidence score (0-100),
the evidence that produced it, and human-readable reasons** - never a bare
boolean. See `POST /v1/verifications` in `docs/openapi.yaml`.

## 2. Signal reliability tiers

| Tier | Signals | Why |
|---|---|---|
| **Strong** | GPS coordinates + accuracy + freshness (when not mock-flagged), Tor exit-node membership (official list) | Backed by hardware sensors or an authoritative, continuously-updated ground truth. |
| **Moderate** | IP country/ASN/VPN/proxy/datacenter classification, device integrity attestation (Play Integrity / App Attest) | Real, vendor- or platform-operated classification, but inherently probabilistic (VPN providers rotate IP ranges; integrity attestation can be unavailable offline). |
| **Weak (advisory only)** | Timezone, language/locale | Trivially and *legitimately* changed by users (travelers, multilingual users) - spec requirement ยง11. Never enough on their own to flag fraud; only used to reinforce or slightly discount a case that other evidence already made suspicious. |

This tiering is directly encoded in `src/lib/engine/types.ts`
(`DEFAULT_WEIGHTS`): strong/moderate signals dominate the score, timezone and
language contribute single-digit weights.

## 3. Combining evidence, not chaining conditionals

The naive approach ("if GPS says Benin, decision is Benin") is explicitly
rejected by the product spec. Instead:

1. **Evidence Engine** (`src/lib/engine/scoring.ts`) turns every raw signal
   into an `Evidence` record: `{ key, category, value, reliability, source,
   capturedAt, weight, contribution, reason }`. Nothing is discarded, and every
   contribution to the final score is individually inspectable via
   `GET /v1/verifications/:id/evidence`.
2. Crucially, an **IP/GPS country mismatch is not penalized when it is
   plausibly explained** by a detected VPN/proxy/Tor/datacenter IP - this is
   the "VPN scenario" from the spec (a Beninese user through a French VPN
   should not be misclassified as a French user). See
   `ip_explained_by_vpn` in `scoring.ts`.
3. Once **mock location is detected**, GPS-derived positive evidence
   (precision, freshness, country match) is suppressed entirely rather than
   scored - a fabricated coordinate cannot be allowed to "look precise."
4. **Decision Engine** (`src/lib/engine/decision.ts`) turns the confidence
   score into one of three statuses (`VERIFIED` / `SUSPICIOUS` / `UNVERIFIED`)
   against configurable thresholds, then applies the project's allowed-country
   policy and mode-specific hard gates (e.g. `HIGH_SECURITY` requires GPS,
   confirmed device integrity, no mock location, max accuracy, and a
   `VERIFIED` score simultaneously).
5. **Rules Engine** (`src/lib/engine/rulesEngine.ts`) runs last and can
   override the base decision with customer-authored, JSON-AST rules (never
   arbitrary code) - e.g. "IF vpn AND gps_country=BJ AND confidence>=85 THEN
   ALLOW".

Every stage is a pure function taking typed input and returning typed output
- see `tests/pipeline.test.ts` for the full set of scenarios this produces
(clean case, VPN, proxy, Tor, datacenter, mock location, permission denied,
imprecise/stale GPS, contradictory signals, country gate, HIGH_SECURITY gate,
rule override).

## 4. Avoiding false positives

- VPN/proxy/datacenter detection **discounts** confidence, it does not
  automatically block - see `DEFAULT_WEIGHTS.vpn_detected = -5` versus
  `mock_location_detected = -100`-scale impact. A privacy-conscious legitimate
  user on a VPN whose GPS still resolves correctly stays `VERIFIED`/`ACCEPT`.
- Timezone/language mismatches are individually weak (`ยฑ5..8` points) and only
  compound into a real penalty when multiple independent signals disagree at
  once (`contradictory_signals`, requires โ‰ฅ2 independent contradictions).
- All thresholds and weights are per-project and editable from the dashboard
  (`ScoringConfig`, versioned so past decisions remain explainable against the
  weights that were active when they ran) - a customer that finds GeoLock too
  strict or too lenient for their risk tolerance can retune it without a code
  change.

## 5. High-level component diagram

```
Client Platform (web/mobile)
        |
        v
  GeoLock SDK  ── requests permission, reads only lat/lng/accuracy/timestamp
        |            + whatever the OS honestly exposes for mock/integrity
        v
  GeoLock API (Next.js route handlers, Vercel serverless)
        |
        +--> IP Intelligence (pluggable: ip-api.com / ipinfo.io / Tor exit list)
        +--> GPS Engine (reverse geocoding, precision/freshness checks)
        |
        v
  Evidence Engine  -->  Decision Engine  -->  Rules Engine  -->  stored Verification
        |                                                              |
        v                                                              v
   Webhooks (verification.completed/verified/suspicious/rejected)  Dashboard
```

## 6. Data model

See `prisma/schema.prisma`. Key design choices:
- **Multi-tenant by `Organization`**, every `Project`/`ApiKey`/`Rule`/
  `Verification` scoped to it; every API route checks tenant ownership before
  returning or mutating data.
- **`ScoringConfig` is versioned and immutable** - editing weights creates a
  new active version rather than mutating history, so an old verification's
  evidence trail always corresponds to the weights that actually produced it.
- **`UsedNonce`** and rate-limit counters back the anti-replay/rate-limiting
  layer with a Postgres fallback when Redis isn't configured (see
  `docs/SECURITY.md`).

## 7. Deployment target: Vercel

The app is a single Next.js 14 (App Router) project: dashboard pages, REST
API route handlers and the scoring engine all ship together as one
deployment. `DATABASE_URL` points at any Postgres (Vercel Postgres, Neon,
Supabase, RDS); `UPSTASH_REDIS_REST_URL`/`_TOKEN` are optional (rate limiting
and replay protection degrade gracefully to a single-instance in-memory/DB
fallback without them - fine for low-to-moderate traffic, but Redis is
strongly recommended once you run multiple concurrent serverless instances).
