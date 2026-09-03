import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS, type ScoringWeights } from '@/lib/engine/types';
import { updateScoringConfig } from './actions';

const LABELS: Record<keyof ScoringWeights, string> = {
  gps_precise: 'GPS is precise',
  gps_recent: 'GPS is recent',
  gps_country_match: 'GPS country matches',
  ip_consistent: 'IP consistent with GPS (or explained by VPN/proxy/Tor/datacenter)',
  timezone_consistent: 'Timezone consistent',
  language_consistent: 'Language consistent',
  device_physical: 'Device integrity: physical',
  mock_location_not_detected: 'Mock location not detected',
  no_contradictions: 'No contradictions bonus',
  gps_imprecise: 'GPS imprecise (penalty)',
  gps_stale: 'GPS stale (penalty)',
  gps_missing: 'GPS missing (penalty)',
  gps_country_mismatch: 'GPS country mismatch (penalty)',
  ip_country_mismatch: 'IP country mismatch, unexplained (penalty)',
  timezone_mismatch: 'Timezone mismatch (penalty)',
  vpn_detected: 'VPN detected (penalty)',
  proxy_detected: 'Proxy detected (penalty)',
  tor_detected: 'Tor detected (penalty)',
  datacenter_detected: 'Datacenter IP (penalty)',
  mock_location_detected: 'Mock location detected (penalty)',
  mock_location_unavailable: 'Mock location status unavailable (penalty)',
  device_emulator_suspected: 'Emulator suspected (penalty)',
  device_compromised_suspected: 'Compromised device suspected (penalty)',
  contradictory_signals: 'Multiple contradictory signals (penalty)',
};

export default async function ScoringPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project || project.organizationId !== user!.organizationId) notFound();

  const config = await prisma.scoringConfig.findFirst({
    where: { projectId: project.id, isActive: true },
    orderBy: { version: 'desc' },
  });
  const weights = (config?.weights as unknown as ScoringWeights) ?? DEFAULT_WEIGHTS;
  const thresholds = (config?.thresholds as { verifiedMin: number; suspiciousMin: number } | undefined) ?? DEFAULT_THRESHOLDS;

  const action = updateScoringConfig.bind(null, project.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Scoring weights — {project.name}</h1>
        <p className="text-slate-500">
          Version {config?.version ?? 0}. Saving publishes a new immutable version - past verifications keep
          referencing the weights active when they ran.
        </p>
      </div>

      <form action={action} className="card max-w-3xl space-y-6">
        <div>
          <h2 className="mb-3 text-lg font-medium">Decision thresholds</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">VERIFIED minimum confidence</label>
              <input type="number" name="verifiedMin" defaultValue={thresholds.verifiedMin} className="input" />
            </div>
            <div>
              <label className="label">SUSPICIOUS minimum confidence</label>
              <input type="number" name="suspiciousMin" defaultValue={thresholds.suspiciousMin} className="input" />
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-medium">Signal weights</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {(Object.keys(LABELS) as (keyof ScoringWeights)[]).map((key) => (
              <div key={key}>
                <label className="label text-xs">{LABELS[key]}</label>
                <input type="number" name={`weight_${key}`} defaultValue={weights[key]} className="input" />
              </div>
            ))}
          </div>
        </div>

        <button type="submit" className="btn-primary">
          Publish new scoring version
        </button>
      </form>
    </div>
  );
}
