# GeoLock — Privacy by Design

## Consent
- The Web SDK shows a plain-language explanation of *why* location is being
  requested before triggering the browser's native permission prompt
  (`sdk/web/src/index.ts`, `requestConsent`) - never a silent
  `getCurrentPosition()` call.
- If the user declines (either at GeoLock's consent step or at the browser's
  own prompt), GeoLock never falls back to silently inferring location from
  IP and presenting it as GPS-grade; the result is `UNVERIFIED` with
  `LOCATION_PERMISSION_DENIED`/`_REQUIRED`.

## Data minimization
- The SDKs send only what scoring actually uses: latitude, longitude,
  accuracy, timestamp (+ altitude/speed if the platform provides them),
  timezone, language, and the platform-reported mock-location/integrity
  status. No device identifiers, contacts, browsing history, or other
  unrelated data is ever collected.
- The client-supplied IP is never trusted from the request body - it is
  always resolved server-side from the connection (`resolveClientIp`),
  preventing IP spoofing via a forged field.

## Retention
- `Organization.dataRetentionDays` (default 90, configurable per
  organization in Settings) is the intended lifetime of raw verification
  evidence (GPS coordinates, IP address). Operationally, enforce this with a
  scheduled job (e.g. a Vercel Cron hitting a `/api/internal/retention-sweep`
  route you add) that deletes or anonymizes `Verification` rows older than
  the configured window - the column exists and is dashboard-editable today;
  wiring the actual sweep job is a deployment-time configuration step, not a
  missing capability of the schema.

## Encryption
- All traffic is TLS-terminated by Vercel's edge network.
- Secrets at rest: API key secrets are stored as SHA-256 hashes, never
  plaintext (`ApiKey.hashedKey`). Passwords are stored as bcrypt hashes
  (cost factor 12, `src/app/api/auth/register/route.ts`).
- `ApiKey.hmacSecret` and `Webhook.secret` are stored in plaintext in the
  database because they must be used to *compute* HMACs, not just compare a
  hash - the standard pattern for webhook/request-signing secrets (Stripe,
  GitHub, etc. do the same). For a production deployment handling many
  tenants, consider envelope-encrypting these columns with a KMS-managed key
  (e.g. `pgcrypto` + a cloud KMS) - the schema does not preclude this, it is
  a hardening step beyond this reference implementation.

## Access control &amp; audit
- Every read of verification data is scoped to the requesting project's
  tenant (see `docs/SECURITY.md`); there is no endpoint that returns another
  organization's data by ID guessing.
- Administrative access to verification data is itself logged in `AuditLog`
  for accountability (who changed what policy, when).

## Deletion
- Revoking an API key is immediate and irreversible.
- Deleting a `Project` cascades to its `Verification`, `Rule`, `Webhook`, and
  `ApiKey` rows (Prisma `onDelete: Cascade`) - there is no orphaned PII left
  behind after a project is removed.

## What this means for an integrating company
GeoLock is a processor of the *minimum* location data needed to answer one
question - "how credible is this claimed location?" - not a general-purpose
location-tracking or profiling service. Integrators are responsible for their
own end-user privacy notice and legal basis for processing (e.g. GDPR
Art. 6/9 considerations for precise geolocation), but GeoLock's own handling
is built to make that notice truthful: it collects narrowly, explains why,
never overclaims certainty, and gives the end user's data a configurable
expiry.
