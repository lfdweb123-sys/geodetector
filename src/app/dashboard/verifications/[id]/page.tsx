import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { StatusBadge } from '../StatusBadge';
import type { Evidence } from '@/lib/engine/types';

export default async function VerificationDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const verification = await prisma.verification.findUnique({
    where: { id: params.id },
    include: { project: true },
  });
  if (!verification || verification.project.organizationId !== user!.organizationId) notFound();

  const evidence = (verification.signals as unknown as Evidence[]) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-xl font-semibold">{verification.id}</h1>
        <p className="text-slate-500">
          {verification.project.name} · session {verification.sessionId}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card">
          <p className="text-sm text-slate-500">Confidence</p>
          <p className="text-3xl font-semibold">{verification.confidence}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Status</p>
          <StatusBadge status={verification.status} />
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Decision</p>
          <StatusBadge status={verification.decision} />
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Mock location</p>
          <p className="font-medium">{verification.mockLocationStatus}</p>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-lg font-medium">Resolved location</h2>
        <p className="text-sm">
          {[verification.locationCity, verification.locationRegion, verification.locationCountry]
            .filter(Boolean)
            .join(', ') || 'Unknown'}
        </p>
        <div className="mt-3 flex gap-2 text-xs">
          <span className="badge bg-slate-100">IP: {verification.ip}</span>
          <span className="badge bg-slate-100">IP country: {verification.ipCountry ?? '—'}</span>
          {verification.vpnDetected && <span className="badge bg-amber-100 text-amber-700">VPN</span>}
          {verification.proxyDetected && <span className="badge bg-amber-100 text-amber-700">Proxy</span>}
          {verification.torDetected && <span className="badge bg-red-100 text-red-700">Tor</span>}
          {verification.datacenterDetected && <span className="badge bg-slate-200">Datacenter</span>}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-lg font-medium">Reasons</h2>
        <ul className="list-inside list-disc space-y-1 text-sm">
          {(verification.reasons as string[]).map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2 className="mb-3 text-lg font-medium">Evidence trail</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="pb-2">Signal</th>
              <th className="pb-2">Category</th>
              <th className="pb-2">Contribution</th>
              <th className="pb-2">Source</th>
              <th className="pb-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {evidence.map((e, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="py-2 font-mono text-xs">{e.key}</td>
                <td className="py-2 text-xs">{e.category}</td>
                <td className={`py-2 font-medium ${e.contribution >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {e.contribution >= 0 ? '+' : ''}
                  {e.contribution}
                </td>
                <td className="py-2 text-xs text-slate-500">{e.source}</td>
                <td className="py-2 text-xs">{e.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
