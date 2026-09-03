import { randomBytes, createHash, timingSafeEqual } from 'crypto';

const LIVE_PREFIX = 'gl_live_';
const TEST_PREFIX = 'gl_test_';

export interface GeneratedApiKey {
  /** Full secret key - shown to the user exactly once, never persisted in cleartext. */
  rawKey: string;
  /** Non-secret prefix stored alongside the hash, shown in the dashboard (e.g. "gl_live_9f21a3c0"). */
  prefix: string;
  /** SHA-256 hex digest of `rawKey` - what actually gets stored and matched against on auth. */
  hashedKey: string;
  /** Separate secret used only for HMAC request-signature verification (spec ยง21). */
  hmacSecret: string;
}

export function generateApiKey(env: 'live' | 'test' = 'live'): GeneratedApiKey {
  const prefixTag = env === 'live' ? LIVE_PREFIX : TEST_PREFIX;
  const secretPart = randomBytes(24).toString('base64url');
  const rawKey = `${prefixTag}${secretPart}`;
  const prefix = rawKey.slice(0, prefixTag.length + 8);
  return {
    rawKey,
    prefix,
    hashedKey: hashApiKey(rawKey),
    hmacSecret: randomBytes(32).toString('hex'),
  };
}

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

export function verifyApiKeyHash(rawKey: string, hashedKey: string): boolean {
  const computed = Buffer.from(hashApiKey(rawKey), 'hex');
  const expected = Buffer.from(hashedKey, 'hex');
  if (computed.length !== expected.length) return false;
  return timingSafeEqual(computed, expected);
}

export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}
