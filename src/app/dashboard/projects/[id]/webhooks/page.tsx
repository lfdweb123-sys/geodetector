import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { createWebhook, deleteWebhook } from './actions';

const EVENTS = [
  'verification.completed',
  'verification.verified',
  'verification.suspicious',
  'verification.rejected',
];

export default async function WebhooksPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project || project.organizationId !== user!.organizationId) notFound();

  const webhooks = await prisma.webhook.findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'desc' } });
  const createAction = createWebhook.bind(null, project.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Webhooks — {project.name}</h1>
        <p className="text-slate-500">Each delivery is HMAC-SHA256 signed with the webhook's secret in the X-GeoLock-Signature header.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-4 text-lg font-medium">Configured webhooks</h2>
          {webhooks.length === 0 ? (
            <p className="text-sm text-slate-500">No webhooks configured.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {webhooks.map((w) => (
                <li key={w.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{w.url}</p>
                      <p className="text-xs text-slate-500">{w.events.join(', ')}</p>
                    </div>
                    <form action={deleteWebhook.bind(null, project.id, w.id)}>
                      <button type="submit" className="btn-danger text-xs">
                        Delete
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form action={createAction} className="card">
          <h2 className="mb-4 text-lg font-medium">New webhook</h2>
          <label className="label">URL</label>
          <input name="url" type="url" required className="input mb-4" placeholder="https://example.com/hooks/geolock" />
          <p className="label">Events</p>
          <div className="mb-4 space-y-2">
            {EVENTS.map((e) => (
              <label key={e} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={`event_${e}`} defaultChecked className="h-4 w-4" />
                {e}
              </label>
            ))}
          </div>
          <button type="submit" className="btn-primary w-full">
            Add webhook
          </button>
        </form>
      </div>
    </div>
  );
}
