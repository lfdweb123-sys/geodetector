# GeoLock — Security Model

GeoLock is built to be integrated by companies making access-control
decisions, so it is designed as a security product first.

## API key management
- Keys are generated as `gl_live_...` / `gl_test_...`, shown **exactly once**
  at creation (`src/lib/security/apiKeys.ts`).
- Only a SHA-256 hash (`hashedKey`) is persisted; authentication does a
  constant-time comparison (`timingSafeEqual`) against that hash - never a
  plain string equality.
- Revocation is immediate and permanent (`ApiKey.revokedAt`); there is no
  "undo".
- Rotation: create a new key, roll it out, then revoke the old one - both can
  be active simultaneously so there is no downtime window.

## Request signing (optional, recommended for production)
- `X-GeoLock-Signature` / `-Timestamp` / `-Nonce` headers, verified in
  `src/lib/security/signature.ts` and `replay.ts`.
- Signature = `HMAC-SHA256(hmacSecret, "${timestamp}.${nonce}.${rawBody}")`,
  compared with `timingSafeEqual`.
- Requests older/newer than 5 minutes are rejected (`MAX_CLOCK_SKEW_SECONDS`)
  regardless of signature validity.
- Each `(projectId, nonce)` pair can be claimed exactly once
  (`claimNonce`), backed by Redis when configured, a Postgres `UsedNonce`
  table otherwise, and an in-memory map as a last-resort single-instance
  fallback. A replayed request gets `409 Conflict`.
- A bearer API key alone is still accepted without signing for simple
  integrations; signing is the hardened path for anyone who wants
  tamper-evidence and hard anti-replay guarantees on top of TLS.

## Anti-replay on verification *results*
A `location_verified: true` response is not a bearer token an attacker can
capture and reuse forever:
- Every verification response includes a **short-lived (5 min), single-use
  `token`** (`src/lib/security/verificationToken.ts`), bound to the
  verification ID and session ID via HMAC.
- The hash is stored (`Verification.tokenHash`), never the raw token.
- A client platform that wants to re-confirm a specific verification result
  presents the token back; it is rejected once expired or once already
  consumed (`consumedAt`).

## Rate limiting
- Sliding-window limiting per API key (`src/lib/security/rateLimit.ts`),
  backed by `@upstash/ratelimit` when Redis is configured, an in-memory
  window otherwise (single-instance only - configure Upstash Redis before
  scaling to multiple serverless instances).
- Exceeding the limit returns `429` before any verification logic runs.

## Input validation
- Every request body is validated with `zod` schemas
  (`src/lib/validation/schemas.ts`) before touching the database or the
  scoring engine - malformed or out-of-range values (e.g. latitude outside
  [-90, 90]) are rejected with `422`, never silently coerced.
- Rule conditions are a constrained JSON AST (`field`/`op`/`value`,
  `and`/`or`/`not`), never arbitrary expressions or code - a customer-authored
  rule cannot execute anything beyond comparing known fields.

## Tenant isolation / RBAC
- Every resource (`Project`, `ApiKey`, `Rule`, `Webhook`, `Verification`) is
  scoped to an `Organization`; every dashboard-session route re-checks
  `project.organizationId === session.user.organizationId` before returning
  or mutating anything - there is no cross-tenant ID guessing surface.
- Roles: `OWNER` / `ADMIN` / `MEMBER`. Mutating endpoints (create/revoke keys,
  edit projects, publish scoring changes) require `ADMIN` or `OWNER`;
  `MEMBER` is read-only in the dashboard.
- API-key-authenticated endpoints (`/v1/verifications`, `/v1/usage`) are
  scoped to the single project the key belongs to - a key can never read or
  write another project's data.

## Injection / XSS / CORS / CSRF
- All database access goes through Prisma's parameterized query builder - no
  raw SQL string concatenation anywhere in the codebase.
- The dashboard is server-rendered (Next.js App Router); user-controlled
  values are never interpolated into `dangerouslySetInnerHTML`.
- `/v1/*` routes are stateless, Bearer-token-authenticated APIs, so they are
  not CSRF-relevant (no ambient cookie-based auth is used to authorize them).
  The dashboard's session cookie is `httpOnly` (NextAuth default) and dashboard
  mutations run through Next.js Server Actions, which NextAuth/Next.js protect
  against cross-origin form submission by design.
- Secrets (`DATABASE_URL`, `NEXTAUTH_SECRET`, `VERIFICATION_TOKEN_SECRET`,
  `IPINFO_TOKEN`, Upstash credentials) are read exclusively from environment
  variables - see `.env.example` - never hardcoded or committed.

## Audit logging
- Every administrative mutation (project created/updated, API key
  created/revoked, rule created/updated/deleted, webhook created/deleted,
  organization settings changed, scoring config published) is recorded in
  `AuditLog` with actor, action, target and timestamp, visible on the
  dashboard's Logs page.

## Webhooks
- Each delivery is HMAC-SHA256 signed with the webhook's own per-webhook
  secret, sent in `X-GeoLock-Signature` - receivers should verify it before
  trusting the payload, the same pattern as Stripe/GitHub webhooks.
- Every attempt (success or failure, status code) is recorded in
  `WebhookDelivery` for observability.

## Known dependency risk (action required before production)

This build pins `next@14.2.35` (the latest 14.x patch at time of writing).
`npm audit` still reports outstanding Next.js advisories whose fixes were
only backported up to a point in the 14.x line, with the remainder requiring
Next 15/16 - a migration involving the async `params`/`headers`/`cookies()`
APIs that this codebase does not yet use. Before taking this to production:
run `npm audit`, evaluate whether the outstanding advisories apply to this
app's actual surface (no `next/image`, no i18n routing, no custom
`middleware.ts` are used here, which rules out several of them), and plan the
Next 15/16 migration if not. Do not treat "deployed" as "fully patched."

## What GeoLock deliberately does **not** claim
Per the product's own operating principle: GeoLock is not "impossible to
bypass" and does not claim to always know a user's true location. See
`docs/ARCHITECTURE.md` ยง1 for the exact boundaries, and note that every
verification response includes a confidence score, evidence and reasons
specifically so an integrator never has to take a bare boolean on faith.
