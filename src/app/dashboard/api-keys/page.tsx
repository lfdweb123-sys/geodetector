import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { ApiKeyCreateForm } from './ApiKeyCreateForm';
import { revokeApiKeyAction } from './actions';

export default async function ApiKeysPage() {
  const user = await getCurrentUser();
  const projects = await prisma.project.findMany({ where: { organizationId: user!.organizationId } });
  const keys = await prisma.apiKey.findMany({
    where: { project: { organizationId: user!.organizationId } },
    include: { project: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">API Keys</h1>
        <p className="text-slate-500">Keys are stored hashed - the raw secret is shown once, at creation.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-4 text-lg font-medium">All keys</h2>
          {projects.length === 0 ? (
            <p className="text-sm text-slate-500">Create a project first.</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-slate-500">No API keys yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-2">Prefix</th>
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Project</th>
                  <th className="pb-2">Last used</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 font-mono text-xs">{k.prefix}…</td>
                    <td className="py-2">{k.name}</td>
                    <td className="py-2">{k.project.name}</td>
                    <td className="py-2 text-slate-500">{k.lastUsedAt ? k.lastUsedAt.toLocaleString() : 'never'}</td>
                    <td className="py-2">
                      {k.revokedAt ? (
                        <span className="badge bg-slate-100 text-slate-500">revoked</span>
                      ) : (
                        <span className="badge bg-emerald-100 text-emerald-700">active</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {!k.revokedAt && (
                        <form action={revokeApiKeyAction.bind(null, k.id)}>
                          <button type="submit" className="btn-danger text-xs">
                            Revoke
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {projects.length > 0 && <ApiKeyCreateForm projects={projects.map((p) => ({ id: p.id, name: p.name }))} />}
      </div>
    </div>
  );
}
