import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export default async function LogsPage() {
  const user = await getCurrentUser();
  const logs = await prisma.auditLog.findMany({
    where: { organizationId: user!.organizationId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit logs</h1>
        <p className="text-slate-500">Every administrative action taken on your organization's account.</p>
      </div>

      <div className="card">
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500">No audit events yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2">Action</th>
                <th className="pb-2">Target</th>
                <th className="pb-2">IP</th>
                <th className="pb-2">When</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 font-mono text-xs">{log.action}</td>
                  <td className="py-2 text-xs">
                    {log.targetType}
                    {log.targetId ? ` · ${log.targetId}` : ''}
                  </td>
                  <td className="py-2 text-xs text-slate-500">{log.ip ?? '—'}</td>
                  <td className="py-2 text-slate-500">{log.createdAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
