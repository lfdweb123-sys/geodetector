// Real Tor exit-node detection using the Tor Project's own official bulk exit
// list (https://check.torproject.org/torbulkexitlist). This is the same data
// source Tor recommends for third-party exit-node checks. No IP database
// vendor labels an address "Tor" with full accuracy - this is the ground
// truth authority for exit nodes, refreshed periodically and cached in memory.

const TOR_EXIT_LIST_URL = 'https://check.torproject.org/torbulkexitlist';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

let cache: { ips: Set<string>; fetchedAt: number } | null = null;
let inFlight: Promise<Set<string>> | null = null;

async function fetchExitList(): Promise<Set<string>> {
  const res = await fetch(TOR_EXIT_LIST_URL, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Tor exit list fetch failed: HTTP ${res.status}`);
  }
  const text = await res.text();
  const ips = new Set(
    text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#')),
  );
  return ips;
}

/**
 * Returns true/false when the list is available, or `undefined` if the list
 * could not be fetched (network failure) - callers must treat `undefined` as
 * "unknown", never as "not Tor".
 */
export async function isTorExitNode(ip: string): Promise<boolean | undefined> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.ips.has(ip);
  }
  try {
    if (!inFlight) {
      inFlight = fetchExitList().finally(() => {
        inFlight = null;
      });
    }
    const ips = await inFlight;
    cache = { ips, fetchedAt: now };
    return ips.has(ip);
  } catch {
    // Fetch failed - if we have a stale cache, prefer stale data over "unknown".
    if (cache) return cache.ips.has(ip);
    return undefined;
  }
}

export function __resetTorExitListCacheForTests() {
  cache = null;
  inFlight = null;
}
