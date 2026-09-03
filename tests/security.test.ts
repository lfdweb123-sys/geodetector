import { describe, expect, it } from 'vitest';
import { generateApiKey, hashApiKey, verifyApiKeyHash } from '@/lib/security/apiKeys';
import { computeSignature, verifySignature, isTimestampFresh } from '@/lib/security/signature';
import { issueVerificationToken, verifyVerificationToken } from '@/lib/security/verificationToken';

describe('API keys', () => {
  it('generates a key whose hash matches verification but a tampered key does not', () => {
    const generated = generateApiKey('live');
    expect(generated.rawKey.startsWith('gl_live_')).toBe(true);
    expect(verifyApiKeyHash(generated.rawKey, generated.hashedKey)).toBe(true);
    expect(verifyApiKeyHash(`${generated.rawKey}x`, generated.hashedKey)).toBe(false);
  });

  it('hash is deterministic for the same input', () => {
    expect(hashApiKey('abc')).toBe(hashApiKey('abc'));
    expect(hashApiKey('abc')).not.toBe(hashApiKey('abd'));
  });
});

describe('request signing (anti-tamper / anti-replay)', () => {
  it('accepts a correctly signed request and rejects a tampered body', () => {
    const secret = 'shhh';
    const timestamp = String(Date.now() / 1000);
    const nonce = 'n1';
    const rawBody = JSON.stringify({ session_id: 's1' });
    const signature = computeSignature({ secret, timestamp, nonce, rawBody });

    expect(verifySignature({ secret, timestamp, nonce, rawBody, signature })).toBe(true);
    expect(
      verifySignature({ secret, timestamp, nonce, rawBody: JSON.stringify({ session_id: 's2' }), signature }),
    ).toBe(false);
    expect(verifySignature({ secret: 'wrong', timestamp, nonce, rawBody, signature })).toBe(false);
  });

  it('rejects timestamps outside the freshness window', () => {
    const now = Date.now();
    expect(isTimestampFresh(String(now / 1000), now)).toBe(true);
    expect(isTimestampFresh(String(now / 1000 - 3600), now)).toBe(false);
  });
});

describe('short-lived verification tokens', () => {
  const secret = 'test-secret';
  process.env.VERIFICATION_TOKEN_SECRET = secret;

  it('validates a fresh, unconsumed token and rejects reuse/expiry/tampering', () => {
    const { token, tokenHash, expiresAt } = issueVerificationToken('ver_1', 'session_1');

    const okResult = verifyVerificationToken({
      token,
      sessionId: 'session_1',
      expectedHash: tokenHash,
      expiresAt,
      consumedAt: null,
    });
    expect(okResult.valid).toBe(true);

    const consumedResult = verifyVerificationToken({
      token,
      sessionId: 'session_1',
      expectedHash: tokenHash,
      expiresAt,
      consumedAt: new Date(),
    });
    expect(consumedResult.valid).toBe(false);
    expect(consumedResult.reason).toBe('TOKEN_ALREADY_CONSUMED');

    const expiredResult = verifyVerificationToken({
      token,
      sessionId: 'session_1',
      expectedHash: tokenHash,
      expiresAt: new Date(Date.now() - 1000),
      consumedAt: null,
    });
    expect(expiredResult.valid).toBe(false);
    expect(expiredResult.reason).toBe('TOKEN_EXPIRED');

    const wrongSessionResult = verifyVerificationToken({
      token,
      sessionId: 'someone_else',
      expectedHash: tokenHash,
      expiresAt,
      consumedAt: null,
    });
    expect(wrongSessionResult.valid).toBe(false);
  });
});
