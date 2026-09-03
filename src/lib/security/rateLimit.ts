import { Ratelimit } from '@upstash/ratelimit';
import { getRedis } from './redis';

const WINDOW_SECONDS = 60;
const DEFAULT_LIMIT_PER_MINUTE = 120;

let upstashLimiter: Ratelimit | null | undefined;

function getUpstashLimiter(): Ratelimit | null {
  if (upstashLimiter !== undefined) return upstashLimiter;
  const redis = getRedis();
  if (!redis) {
    upstashLimiter = null;
    return upstashLimiter;
  }
  upstashLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(DEFAULT_LIMIT_PER_MINUTE, `${WINDOW_SECONDS} s`),
    prefix: 'geolock:ratelimit',
  });
  return upstashLimiter;
}

// Single-instance fallback (documented limitation, same as replay.ts).
const memoryWindows = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtMs: number;
}

export async function checkRateLimit(
  identifier: string,
  limitPerMinute: number = DEFAULT_LIMIT_PER_MINUTE,
): Promise<RateLimitResult> {
  const limiter = getUpstashLimiter();
  if (limiter) {
    const result = await limiter.limit(identifier);
    return {
      allowed: result.success,
      limit: result.limit,
      remaining: result.remaining,
      resetAtMs: result.reset,
    };
  }

  const now = Date.now();
  const windowStart = now - WINDOW_SECONDS * 1000;
  const timestamps = (memoryWindows.get(identifier) ?? []).filter((t) => t > windowStart);
  const allowed = timestamps.length < limitPerMinute;
  if (allowed) timestamps.push(now);
  memoryWindows.set(identifier, timestamps);

  return {
    allowed,
    limit: limitPerMinute,
    remaining: Math.max(0, limitPerMinute - timestamps.length),
    resetAtMs: windowStart + WINDOW_SECONDS * 1000 + WINDOW_SECONDS * 1000,
  };
}
