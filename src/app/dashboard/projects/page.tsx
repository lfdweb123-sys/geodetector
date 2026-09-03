import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { createProject } from './actions';

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  const projects = await prisma.project.findMany({
    where: { organizationId: user!.organizationId },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="text-slate-500">A project groups an integration's API keys, policy and rules.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-4 text-lg font-medium">Your projects</h2>
          {projects.length === 0 ? (
            <p className="text-sm text-slate-500">No projects yet - create one to get an API key.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {projects.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-3">
                  <div>
                    <Link href={`/dashboard/projects/${p.id}`} className="font-medium text-brand-700 hover:underline">
                      {p.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {p.mode} · {p.allowedCountries.length > 0 ? p.allowedCountries.join(', ') : 'Any country'}
                    </p>
                  </div>
                  <Link href={`/dashboard/projects/${p.id}`} className="btn-secondary text-xs">
                    Manage
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form action={createProject} className="card">
          <h2 className="mb-4 text-lg font-medium">New project</h2>
          <label className="label">Name</label>
          <input name="name" required className="input mb-4" placeholder="Production" />
          <label className="label">Mode</label>
          <select name="mode" className="input mb-4">
            <option value="STANDARD">STANDARD</option>
            <option value="STRICT">STRICT</option>
            <option value="HIGH_SECURITY">HIGH_SECURITY</option>
            <option value="CUSTOM">CUSTOM</option>
          </select>
          <label className="label">Allowed countries (ISO2, comma-separated)</label>
          <input name="allowedCountries" className="input mb-4" placeholder="BJ" />
          <label className="mb-4 flex items-center gap-2 text-sm">
            <input type="checkbox" name="requireLocation" defaultChecked className="h-4 w-4" />
            Require GPS location
          </label>
          <button type="submit" className="btn-primary w-full">
            Create project
          </button>
        </form>
      </div>
    </div>
  );
}
