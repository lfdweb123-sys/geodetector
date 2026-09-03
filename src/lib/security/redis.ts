import { Redis } from '@upstash/redis';

let client: Redis | null | undefined;

/**
 * Returns a shared Upstash Redis client, or `null` when Redis isn't
 * configured. Callers must fall back to a DB- or memory-backed strategy in
 * that case - Redis is an optimization, not a hard dependency, so a
 * single-region deployment without it still works (with the documented
 * single-instance caveat for the in-memory fallback).
 */
export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    client = null;
    return client;
  }
  client = new Redis({ url, token });
  return client;
}
