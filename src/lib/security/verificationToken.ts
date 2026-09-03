import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const DEFAULT_TTL_SECONDS = 5 * 60;

function secret(): string {
  const s = process.env.VERIFICATION_TOKEN_SECRET;
  if (!s) throw new Error('VERIFICATION_TOKEN_SECRET is not configured');
  return s;
}

/**
 * A verification result is bound to a single-use, short-lived token (spec
 * ยง21/22): a client platform cannot replay an old `location_verified: true`
 * response indefinitely, because the token expires and is consumed on first
 * use. Only the SHA-256-style HMAC hash is persisted - the raw token is
 * returned to the caller exactly once, in the verification response.
 */
export function issueVerificationToken(verificationId: string, sessionId: string) {
  const random = randomBytes(16).toString('base64url');
  const raw = `${verificationId}.${random}`;
  const hash = createHmac('sha256', secret()).update(`${raw}:${sessionId}`).digest('hex');
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_SECONDS * 1000);
  return { token: raw, tokenHash: hash, expiresAt };
}

export function verifyVerificationToken(params: {
  token: string;
  sessionId: string;
  expectedHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  now?: Date;
}): { valid: boolean; reason?: string } {
  const now = params.now ?? new Date();
  if (params.consumedAt) return { valid: false, reason: 'TOKEN_ALREADY_CONSUMED' };
  if (now > params.expiresAt) return { valid: false, reason: 'TOKEN_EXPIRED' };

  const computed = createHmac('sha256', secret())
    .update(`${params.token}:${params.sessionId}`)
    .digest('hex');
  const computedBuf = Buffer.from(computed, 'utf8');
  const expectedBuf = Buffer.from(params.expectedHash, 'utf8');
  if (computedBuf.length !== expectedBuf.length || !timingSafeEqual(computedBuf, expectedBuf)) {
    return { valid: false, reason: 'TOKEN_INVALID' };
  }
  return { valid: true };
}
