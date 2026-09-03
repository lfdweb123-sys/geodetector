import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { planInfo } from '@/lib/billing';
import { UsageChart } from './UsageChart';

export default async function UsagePage({ searchParams }: { searchParams: { projectId?: string } }) {
  const user = await getCurrentUser();
  const org = await prisma.organization.findUnique({ where: { id: user!.organizationId } });
  const projects = await prisma.project.findMany({ where: { organizationId: user!.organizationId } });
  const projectId = searchParams.projectId ?? projects[0]?.id;

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  since.setUTCHours(0, 0, 0, 0);

  const records = projectId
    ? await prisma.usageRecord.findMany({ where: { projectId, day: { gte: since } }, orderBy: { day: 'asc' } })
    : [];

  const data = records.map((r) => ({ date: r.day.toISOString().slice(5, 10), count: r.count }));
  const total = records.reduce((s, r) => s + r.count, 0);

  const quota = planInfo(org?.plan ?? 'FREE').quota;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Usage</h1>
        <p className="text-slate-500">Last 30 days · plan: {org?.plan}</p>
      </div>

      <div className="flex gap-2">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/dashboard/usage?projectId=${p.id}`}
            className={p.id === projectId ? 'btn-primary text-xs' : 'btn-secondary text-xs'}
          >
            {p.name}
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="mb-4 flex items-baseline justify-between">
          <p className="text-3xl font-semibold">{total.toLocaleString()} verifications</p>
          {quota !== Infinity && <p className="text-sm text-slate-500">of {quota.toLocaleString()} monthly quota</p>}
        </div>
        {data.length === 0 ? <p className="text-sm text-slate-500">No usage recorded yet.</p> : <UsageChart data={data} />}
      </div>
    </div>
  );
}
