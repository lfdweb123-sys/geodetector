import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/security/redis', () => ({ getRedis: () => null }));

const { checkRateLimit } = await import('@/lib/security/rateLimit');

describe('rate limiting (in-memory fallback)', () => {
  it('allows requests under the limit and blocks once exceeded', async () => {
    const id = `key_${Math.random()}`;
    const limit = 5;

    const results = [];
    for (let i = 0; i < limit + 2; i++) {
      results.push(await checkRateLimit(id, limit));
    }

    expect(results.slice(0, limit).every((r) => r.allowed)).toBe(true);
    expect(results.slice(limit).every((r) => !r.allowed)).toBe(true);
  });

  it('tracks separate identifiers independently', async () => {
    const a = await checkRateLimit(`a_${Math.random()}`, 1);
    const b = await checkRateLimit(`b_${Math.random()}`, 1);
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });
});
