// GeoLock Web SDK
//
// Honest by design: this SDK never claims to defeat browser protections, never
// silently reads more than the coordinates the user explicitly approved, and
// never asserts a location with unconditional certainty - every result carries
// a confidence score, reasons, and (when relevant) an explicit UNAVAILABLE
// status for signals the browser simply cannot provide (mock-location
// detection and device integrity are not exposed by any Web API).

export type MockLocationStatus = 'DETECTED' | 'NOT_DETECTED' | 'UNAVAILABLE';
export type VerificationStatusValue = 'VERIFIED' | 'SUSPICIOUS' | 'UNVERIFIED';
export type DecisionValue = 'ACCEPT' | 'REJECT' | 'MANUAL_REVIEW';

export interface GeoLockVerifyOptions {
  /** Required ISO 3166-1 alpha-2 country code, e.g. "BJ". */
  country?: string;
  /** Whether a GPS fix is mandatory. Defaults to true. */
  requireLocation?: boolean;
  /** Client-side hint only (informational) - the server-side project config is authoritative. */
  maxAccuracy?: number;
  /**
   * Recommended: your own backend route that holds the GeoLock secret API key
   * and forwards the request. Never ship a secret key in browser code.
   * Defaults to "/api/geolock/verify".
   */
  endpoint?: string;
  /**
   * Direct-mode only (advanced / non-public contexts): calls GeoLock's API
   * straight from the browser using `apiKey`. Because this exposes the key to
   * anyone who opens dev tools, only use this with a key scoped down for
   * public use, never with a full-privilege secret key.
   */
  apiBaseUrl?: string;
  apiKey?: string;
  sessionId?: string;
  /** Show a short explanation before requesting the browser's location permission (spec: privacy-by-design). Defaults to true. */
  showConsentUI?: boolean;
  consentMessage?: string;
  /** getCurrentPosition timeout in ms. Defaults to 10000. */
  timeout?: number;
}

export interface GeoLockVerifyResult {
  verification_id: string | null;
  location_verified: boolean;
  status: VerificationStatusValue;
  decision: DecisionValue;
  confidence: number;
  location: { country: string | null; region: string | null; city: string | null } | null;
  vpn: boolean;
  proxy: boolean;
  tor: boolean;
  datacenter: boolean;
  mock_location: MockLocationStatus;
  reasons: string[];
  token: string | null;
  error: string | null;
}

const SESSION_STORAGE_KEY = 'geolock_session_id';

function getOrCreateSessionId(explicit?: string): string {
  if (explicit) return explicit;
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const generated = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, generated);
    return generated;
  } catch {
    // sessionStorage unavailable (privacy mode, etc.) - fall back to a
    // per-call id; retries just won't be correlated server-side.
    return crypto.randomUUID();
  }
}

function unverified(error: string, reasons: string[] = []): GeoLockVerifyResult {
  return {
    verification_id: null,
    location_verified: false,
    status: 'UNVERIFIED',
    decision: 'REJECT',
    confidence: 0,
    location: null,
    vpn: false,
    proxy: false,
    tor: false,
    datacenter: false,
    mock_location: 'UNAVAILABLE',
    reasons,
    token: null,
    error,
  };
}

/**
 * Renders a minimal, unstyled-by-default consent notice explaining why
 * location is requested, before the browser's own permission prompt fires.
 * Returns true if the user proceeds, false if they decline.
 */
function requestConsent(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-geolock-consent', '');
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(15, 23, 42, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '2147483647',
      fontFamily: 'system-ui, sans-serif',
    } as CSSStyleDeclaration);

    const card = document.createElement('div');
    Object.assign(card.style, {
      background: '#fff',
      borderRadius: '12px',
      padding: '20px 24px',
      maxWidth: '360px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
    } as CSSStyleDeclaration);

    const text = document.createElement('p');
    text.textContent = message;
    Object.assign(text.style, { margin: '0 0 16px', fontSize: '14px', color: '#0f172a' } as CSSStyleDeclaration);

    const actions = document.createElement('div');
    Object.assign(actions.style, { display: 'flex', gap: '8px', justifyContent: 'flex-end' } as CSSStyleDeclaration);

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Decline';
    Object.assign(cancelBtn.style, {
      padding: '8px 14px',
      borderRadius: '8px',
      border: '1px solid #cbd5e1',
      background: '#fff',
      cursor: 'pointer',
    } as CSSStyleDeclaration);

    const allowBtn = document.createElement('button');
    allowBtn.textContent = 'Share location';
    Object.assign(allowBtn.style, {
      padding: '8px 14px',
      borderRadius: '8px',
      border: 'none',
      background: '#3182f6',
      color: '#fff',
      cursor: 'pointer',
    } as CSSStyleDeclaration);

    const cleanup = (result: boolean) => {
      document.body.removeChild(overlay);
      resolve(result);
    };
    cancelBtn.onclick = () => cleanup(false);
    allowBtn.onclick = () => cleanup(true);

    actions.append(cancelBtn, allowBtn);
    card.append(text, actions);
    overlay.append(card);
    document.body.appendChild(overlay);
  });
}

function getPosition(timeout: number): Promise<{ position: GeolocationPosition | null; permissionDenied: boolean }> {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ position, permissionDenied: false }),
      (error) => resolve({ position: null, permissionDenied: error.code === error.PERMISSION_DENIED }),
      { enableHighAccuracy: true, timeout, maximumAge: 0 },
    );
  });
}

export async function verify(options: GeoLockVerifyOptions = {}): Promise<GeoLockVerifyResult> {
  const requireLocation = options.requireLocation ?? true;
  const sessionId = getOrCreateSessionId(options.sessionId);
  const timeout = options.timeout ?? 10000;

  const geolocationSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  if (requireLocation && !geolocationSupported) {
    return unverified('GEOLOCATION_UNSUPPORTED', ['This browser does not support the Geolocation API']);
  }

  let location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  } | null = null;
  let permissionDenied = false;

  if (geolocationSupported) {
    const showConsentUI = options.showConsentUI ?? true;
    const proceed = showConsentUI
      ? await requestConsent(
          options.consentMessage ??
            'This site needs your precise location to verify eligibility for this service. Your coordinates are sent securely and are never sold or shared for advertising.',
        )
      : true;

    if (!proceed) {
      permissionDenied = true;
    } else {
      const { position, permissionDenied: denied } = await getPosition(timeout);
      permissionDenied = denied;
      if (position) {
        location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };
      }
    }
  }

  const body = {
    session_id: sessionId,
    required_country: options.country,
    location,
    location_permission_denied: permissionDenied,
    client: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
    },
    device: {
      // The Web Platform exposes no mock-location or device-integrity APIs -
      // reporting anything else here would be a fabricated guarantee.
      mockLocationStatus: 'UNAVAILABLE' as MockLocationStatus,
      integrity: 'UNAVAILABLE' as const,
    },
    client_max_accuracy_hint: options.maxAccuracy,
  };

  const url = options.apiBaseUrl && options.apiKey ? `${options.apiBaseUrl}/v1/verifications` : options.endpoint ?? '/api/geolock/verify';
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.apiBaseUrl && options.apiKey) {
    headers.authorization = `Bearer ${options.apiKey}`;
  }

  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch {
    return unverified('NETWORK_ERROR', ['Unable to reach the verification service']);
  }

  if (!res.ok) {
    return unverified('VERIFICATION_REQUEST_FAILED', [`Verification request failed with HTTP ${res.status}`]);
  }

  const data = (await res.json()) as {
    id: string;
    status: VerificationStatusValue;
    decision: DecisionValue;
    confidence: number;
    location: { country: string | null; region: string | null; city: string | null };
    vpn: boolean;
    proxy: boolean;
    tor: boolean;
    datacenter: boolean;
    mock_location: MockLocationStatus;
    reasons: string[];
    token?: string;
  };

  return {
    verification_id: data.id,
    location_verified: data.decision === 'ACCEPT',
    status: data.status,
    decision: data.decision,
    confidence: data.confidence,
    location: data.location,
    vpn: data.vpn,
    proxy: data.proxy,
    tor: data.tor,
    datacenter: data.datacenter,
    mock_location: data.mock_location,
    reasons: data.reasons,
    token: data.token ?? null,
    error: null,
  };
}

export const GeoLock = { verify };
export default GeoLock;
