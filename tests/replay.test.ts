import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/security/redis', () => ({ getRedis: () => null }));
vi.mock('@/lib/db', () => ({
  prisma: {
    usedNonce: {
      create: vi.fn().mockRejectedValue(new Error('no database in unit tests')),
    },
  },
}));

const { claimNonce } = await import('@/lib/security/replay');

describe('anti-replay nonce claiming', () => {
  it('accepts a nonce the first time and rejects it on replay', async () => {
    const projectId = 'proj_1';
    const nonce = `nonce_${Math.random()}`;

    const first = await claimNonce(projectId, nonce);
    const second = await claimNonce(projectId, nonce);

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('scopes nonces per project', async () => {
    const nonce = `shared_${Math.random()}`;
    const first = await claimNonce('proj_a', nonce);
    const second = await claimNonce('proj_b', nonce);

    expect(first).toBe(true);
    expect(second).toBe(true);
  });
});
