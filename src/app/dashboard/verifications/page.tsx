import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { StatusBadge } from './StatusBadge';

export default async function VerificationsPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const user = await getCurrentUser();
  const projects = await prisma.project.findMany({ where: { organizationId: user!.organizationId } });
  const projectId = searchParams.projectId ?? projects[0]?.id;

  const verifications = projectId
    ? await prisma.verification.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Verifications</h1>
        <p className="text-slate-500">Every decision, with the evidence and reasons behind it.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/dashboard/verifications?projectId=${p.id}`}
            className={p.id === projectId ? 'btn-primary text-xs' : 'btn-secondary text-xs'}
          >
            {p.name}
          </Link>
        ))}
      </div>

      <div className="card">
        {verifications.length === 0 ? (
          <p className="text-sm text-slate-500">No verifications for this project yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-2">ID</th>
                  <th className="pb-2">Session</th>
                  <th className="pb-2">Location</th>
                  <th className="pb-2">Confidence</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Decision</th>
                  <th className="pb-2">VPN</th>
                  <th className="pb-2">Mock GPS</th>
                  <th className="pb-2">When</th>
                </tr>
              </thead>
              <tbody>
                {verifications.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2">
                      <Link
                        href={`/dashboard/verifications/${v.id}`}
                        className="font-mono text-xs text-brand-700 hover:underline"
                      >
                        {v.id}
                      </Link>
                    </td>
                    <td className="py-2 font-mono text-xs">{v.sessionId}</td>
                    <td className="py-2">{[v.locationCity, v.locationCountry].filter(Boolean).join(', ') || '—'}</td>
                    <td className="py-2">{v.confidence}</td>
                    <td className="py-2">
                      <StatusBadge status={v.status} />
                    </td>
                    <td className="py-2">
                      <StatusBadge status={v.decision} />
                    </td>
                    <td className="py-2">{v.vpnDetected ? 'yes' : 'no'}</td>
                    <td className="py-2">{v.mockLocationStatus}</td>
                    <td className="py-2 text-slate-500">{v.createdAt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
