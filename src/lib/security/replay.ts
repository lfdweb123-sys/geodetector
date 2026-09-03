import { prisma } from '../db';
import { getRedis } from './redis';

const NONCE_TTL_SECONDS = 10 * 60; // must exceed MAX_CLOCK_SKEW_SECONDS

// Single-instance fallback used only when neither Redis nor the DB is
// reachable at request time (e.g. local dev without Postgres). Documented
// limitation: does not protect across multiple server instances.
const memoryNonces = new Map<string, number>();

function memoryKey(projectId: string, nonce: string) {
  return `${projectId}:${nonce}`;
}

function pruneMemory(now: number) {
  for (const [key, expiresAt] of memoryNonces) {
    if (expiresAt <= now) memoryNonces.delete(key);
  }
}

/**
 * Atomically claims a (projectId, nonce) pair. Returns `true` the first time
 * it's seen (request accepted) and `false` on any repeat (replay rejected).
 * Tries Redis first (works across all serverless instances), then the
 * Postgres-backed `UsedNonce` table, then in-memory as a last resort.
 */
export async function claimNonce(projectId: string, nonce: string): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    const key = `geolock:nonce:${projectId}:${nonce}`;
    const result = await redis.set(key, '1', { nx: true, ex: NONCE_TTL_SECONDS });
    return result === 'OK';
  }

  try {
    const expiresAt = new Date(Date.now() + NONCE_TTL_SECONDS * 1000);
    await prisma.usedNonce.create({ data: { projectId, nonce, expiresAt } });
    return true;
  } catch (err) {
    // Unique constraint violation on (projectId, nonce) means replay.
    if ((err as { code?: string }).code === 'P2002') return false;
    // DB unavailable - degrade to in-memory rather than failing verification outright.
    const now = Date.now();
    pruneMemory(now);
    const key = memoryKey(projectId, nonce);
    if (memoryNonces.has(key)) return false;
    memoryNonces.set(key, now + NONCE_TTL_SECONDS * 1000);
    return true;
  }
}
