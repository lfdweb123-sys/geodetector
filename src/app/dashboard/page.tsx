import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { StatusBadge } from './verifications/StatusBadge';

export default async function OverviewPage() {
  const user = await getCurrentUser();
  const projects = await prisma.project.findMany({ where: { organizationId: user!.organizationId } });
  const projectIds = projects.map((p) => p.id);

  const [total, verified, suspicious, unverified, recent] = await Promise.all([
    prisma.verification.count({ where: { projectId: { in: projectIds } } }),
    prisma.verification.count({ where: { projectId: { in: projectIds }, status: 'VERIFIED' } }),
    prisma.verification.count({ where: { projectId: { in: projectIds }, status: 'SUSPICIOUS' } }),
    prisma.verification.count({ where: { projectId: { in: projectIds }, status: 'UNVERIFIED' } }),
    prisma.verification.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ]);

  const stats = [
    { label: 'Total verifications', value: total },
    { label: 'Verified', value: verified },
    { label: 'Suspicious', value: suspicious },
    { label: 'Unverified', value: unverified },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-slate-500">Across {projects.length} project(s) in your organization.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-1 text-3xl font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="mb-4 text-lg font-medium">Recent verifications</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">No verifications yet. Create a project and API key to get started.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2">ID</th>
                <th className="pb-2">Location</th>
                <th className="pb-2">Confidence</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Decision</th>
                <th className="pb-2">When</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((v) => (
                <tr key={v.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 font-mono text-xs">{v.id}</td>
                  <td className="py-2">{[v.locationCity, v.locationCountry].filter(Boolean).join(', ') || '—'}</td>
                  <td className="py-2">{v.confidence}</td>
                  <td className="py-2">
                    <StatusBadge status={v.status} />
                  </td>
                  <td className="py-2">{v.decision}</td>
                  <td className="py-2 text-slate-500">{v.createdAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
