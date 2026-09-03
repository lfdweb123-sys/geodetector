import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { runTestVerification } from './actions';

const WEB_SNIPPET = `import { GeoLock } from '@geolock/web';

const result = await GeoLock.verify({
  country: 'BJ',
  requireLocation: true,
  maxAccuracy: 100,
});

if (result.location_verified) {
  // decision === 'ACCEPT'
} else {
  // result.status, result.reasons, result.confidence
}`;

const CURL_SNIPPET = `curl -X POST https://your-deployment.vercel.app/v1/verifications \\
  -H "Authorization: Bearer $GEOLOCK_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "session_id": "session_123",
    "required_country": "BJ",
    "location": { "latitude": 6.3703, "longitude": 2.3912, "accuracy": 18, "timestamp": 1788390000000 },
    "client": { "timezone": "Africa/Porto-Novo", "language": "fr-BJ" }
  }'`;

export default async function SdkPage() {
  const user = await getCurrentUser();
  const projects = await prisma.project.findMany({ where: { organizationId: user!.organizationId } });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">SDK &amp; Playground</h1>
        <p className="text-slate-500">Integration snippets, plus a live tester that runs the real detection pipeline.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 text-lg font-medium">Web SDK</h2>
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">{WEB_SNIPPET}</pre>
          <p className="mt-2 text-xs text-slate-500">
            npm install @geolock/web · see sdk/web/README.md for the recommended backend-proxy pattern (never embed a
            secret key in browser code).
          </p>
        </div>
        <div className="card">
          <h2 className="mb-2 text-lg font-medium">Server-to-server (any language)</h2>
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">{CURL_SNIPPET}</pre>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-1 text-lg font-medium">Live playground</h2>
        <p className="mb-4 text-sm text-slate-500">
          Runs the exact same evidence/scoring/decision/rules pipeline as the public API, including live IP
          intelligence and reverse-geocoding lookups. Optionally override the IP to simulate a VPN/Tor/datacenter
          exit node.
        </p>
        {projects.length === 0 ? (
          <p className="text-sm text-slate-500">Create a project first.</p>
        ) : (
          <form action={runTestVerification} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Project</label>
              <select name="projectId" className="input" required>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Required country</label>
              <input name="requiredCountry" className="input" placeholder="BJ" />
            </div>
            <div>
              <label className="label">Latitude</label>
              <input name="latitude" type="number" step="any" className="input" placeholder="6.3703" />
            </div>
            <div>
              <label className="label">Longitude</label>
              <input name="longitude" type="number" step="any" className="input" placeholder="2.3912" />
            </div>
            <div>
              <label className="label">GPS accuracy (m)</label>
              <input name="accuracy" type="number" className="input" placeholder="18" />
            </div>
            <div>
              <label className="label">GPS fix age (seconds)</label>
              <input name="ageSeconds" type="number" className="input" placeholder="0" />
            </div>
            <div>
              <label className="label">Timezone</label>
              <input name="timezone" className="input" placeholder="Africa/Porto-Novo" />
            </div>
            <div>
              <label className="label">Language</label>
              <input name="language" className="input" placeholder="fr-BJ" />
            </div>
            <div>
              <label className="label">Mock location status</label>
              <select name="mockLocationStatus" className="input">
                <option value="NOT_DETECTED">NOT_DETECTED</option>
                <option value="DETECTED">DETECTED</option>
                <option value="UNAVAILABLE">UNAVAILABLE</option>
              </select>
            </div>
            <div>
              <label className="label">Device integrity</label>
              <select name="integrity" className="input">
                <option value="PHYSICAL">PHYSICAL</option>
                <option value="EMULATOR_SUSPECTED">EMULATOR_SUSPECTED</option>
                <option value="COMPROMISED_SUSPECTED">COMPROMISED_SUSPECTED</option>
                <option value="UNAVAILABLE">UNAVAILABLE</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Override IP (test-only, e.g. a known VPN exit IP)</label>
              <input name="ip" className="input" placeholder="Leave empty to use your real request IP" />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="permissionDenied" className="h-4 w-4" />
              Simulate location permission denied (ignores lat/lng above)
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary w-full">
                Run verification
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
