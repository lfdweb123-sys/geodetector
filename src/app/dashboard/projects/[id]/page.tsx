import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { updateProjectSettings } from '../actions';
import { CountrySelect } from '../CountrySelect';

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project || project.organizationId !== user!.organizationId) notFound();

  const updateAction = updateProjectSettings.bind(null, project.id);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <p className="text-slate-500">Project ID: {project.id}</p>
        </div>
        <nav className="flex gap-2">
          <Link href={`/dashboard/projects/${project.id}/rules`} className="btn-secondary text-xs">
            Rules
          </Link>
          <Link href={`/dashboard/projects/${project.id}/webhooks`} className="btn-secondary text-xs">
            Webhooks
          </Link>
          <Link href={`/dashboard/projects/${project.id}/scoring`} className="btn-secondary text-xs">
            Scoring weights
          </Link>
          <Link href={`/dashboard/verifications?projectId=${project.id}`} className="btn-secondary text-xs">
            Verifications
          </Link>
          <Link href={`/dashboard/sdk?projectId=${project.id}`} className="btn-secondary text-xs">
            Créer un test
          </Link>
        </nav>
      </div>

      <form action={updateAction} className="card max-w-2xl space-y-4">
        <h2 className="text-lg font-medium">Policy settings</h2>

        <div>
          <label className="label">Name</label>
          <input name="name" defaultValue={project.name} className="input" />
        </div>

        <div>
          <label className="label">Mode</label>
          <select name="mode" defaultValue={project.mode} className="input">
            <option value="STANDARD">STANDARD</option>
            <option value="STRICT">STRICT</option>
            <option value="HIGH_SECURITY">HIGH_SECURITY</option>
            <option value="CUSTOM">CUSTOM</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">
            HIGH_SECURITY requires GPS, confirmed device integrity, no detected mock location and a VERIFIED score.
          </p>
        </div>

        <div>
          <label className="label">Allowed countries</label>
          <CountrySelect name="allowedCountries" defaultValue={project.allowedCountries} />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="requireLocation" defaultChecked={project.requireLocation} className="h-4 w-4" />
          Require GPS location (otherwise returns UNVERIFIED / LOCATION_PERMISSION_REQUIRED)
        </label>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Max GPS accuracy (meters)</label>
            <input
              type="number"
              name="maxAccuracyMeters"
              defaultValue={project.maxAccuracyMeters ?? 150}
              className="input"
            />
          </div>
          <div>
            <label className="label">Max GPS fix age (seconds)</label>
            <input
              type="number"
              name="maxLocationAgeSec"
              defaultValue={project.maxLocationAgeSec ?? 120}
              className="input"
            />
          </div>
        </div>

        <div>
          <label className="label">IP intelligence provider</label>
          <select name="ipIntelProvider" defaultValue={project.ipIntelProvider} className="input">
            <option value="ipapi">ip-api.com (free, no key)</option>
            <option value="ipinfo">ipinfo.io (requires IPINFO_TOKEN)</option>
          </select>
        </div>

        <button type="submit" className="btn-primary">
          Save settings
        </button>
      </form>
    </div>
  );
}
