import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { updateOrganizationSettings } from './actions';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const org = await prisma.organization.findUnique({ where: { id: user!.organizationId } });
  const members = await prisma.user.findMany({ where: { organizationId: user!.organizationId } });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-slate-500">Organization: {org?.name}</p>
      </div>

      <form action={updateOrganizationSettings} className="card max-w-lg space-y-4">
        <h2 className="text-lg font-medium">Organization &amp; privacy</h2>
        <div>
          <label className="label">Organization name</label>
          <input name="name" defaultValue={org?.name} className="input" disabled={user!.role !== 'OWNER'} />
        </div>
        <div>
          <label className="label">Billing email</label>
          <input name="billingEmail" type="email" defaultValue={org?.billingEmail ?? ''} className="input" disabled={user!.role !== 'OWNER'} />
        </div>
        <div>
          <label className="label">Data retention (days)</label>
          <input
            type="number"
            name="dataRetentionDays"
            defaultValue={org?.dataRetentionDays ?? 90}
            className="input"
            disabled={user!.role !== 'OWNER'}
          />
          <p className="mt-1 text-xs text-slate-500">
            Raw verification evidence (GPS coordinates, IP) is not kept longer than this window - privacy by design.
          </p>
        </div>
        {user!.role === 'OWNER' && (
          <button type="submit" className="btn-primary">
            Save
          </button>
        )}
      </form>

      <div className="card max-w-lg">
        <h2 className="mb-3 text-lg font-medium">Members</h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2">
              <span>{m.email}</span>
              <span className="badge bg-slate-100">{m.role}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
