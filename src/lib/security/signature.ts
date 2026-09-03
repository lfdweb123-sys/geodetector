import { createHmac, timingSafeEqual } from 'crypto';

export const SIGNATURE_HEADER = 'x-geolock-signature';
export const TIMESTAMP_HEADER = 'x-geolock-timestamp';
export const NONCE_HEADER = 'x-geolock-nonce';

/** Requests older/newer than this are rejected even with a valid signature (replay window, spec ยง21). */
export const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

export function computeSignature(params: {
  secret: string;
  timestamp: string;
  nonce: string;
  rawBody: string;
}): string {
  const message = `${params.timestamp}.${params.nonce}.${params.rawBody}`;
  return createHmac('sha256', params.secret).update(message, 'utf8').digest('hex');
}

export function verifySignature(params: {
  secret: string;
  timestamp: string;
  nonce: string;
  rawBody: string;
  signature: string;
}): boolean {
  const expected = computeSignature(params);
  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(params.signature, 'utf8');
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

export function isTimestampFresh(timestampHeader: string, now: number = Date.now()): boolean {
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return false;
  const deltaSeconds = Math.abs(now / 1000 - ts);
  return deltaSeconds <= MAX_CLOCK_SKEW_SECONDS;
}
