import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { createRule, deleteRule, toggleRule } from './actions';
import { ActionButton, FormWithToast } from '../../../FormWithToast';
import { BackLink } from '../../../BackLink';

const EXAMPLE_CONDITION = JSON.stringify(
  { and: [{ field: 'vpn', op: 'eq', value: true }, { field: 'confidence', op: 'lt', value: 70 }] },
  null,
  2,
);

export default async function RulesPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project || project.organizationId !== user!.organizationId) notFound();

  const rules = await prisma.rule.findMany({ where: { projectId: project.id }, orderBy: { priority: 'desc' } });
  const createAction = createRule.bind(null, project.id);

  return (
    <div className="space-y-8">
      <BackLink href={`/dashboard/projects/${project.id}`} label={`Retour à ${project.name}`} />
      <div>
        <h1 className="text-2xl font-semibold">Rules — {project.name}</h1>
        <p className="text-slate-500">
          Rules run after scoring and can override the base decision. The highest-priority matching enabled rule
          wins.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-4 text-lg font-medium">Configured rules</h2>
          {rules.length === 0 ? (
            <p className="text-sm text-slate-500">No custom rules - the default scoring-based decision applies.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rules.map((rule) => (
                <li key={rule.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {rule.name} <span className="text-xs text-slate-400">priority {rule.priority}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        Action: <strong>{rule.action}</strong> · {rule.enabled ? 'enabled' : 'disabled'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <ActionButton
                        action={toggleRule.bind(null, project.id, rule.id)}
                        label={rule.enabled ? 'Disable' : 'Enable'}
                        pendingLabel="…"
                        className="text-xs"
                      />
                      <ActionButton
                        action={deleteRule.bind(null, project.id, rule.id)}
                        label="Delete"
                        pendingLabel="…"
                        variant="danger"
                        className="text-xs"
                      />
                    </div>
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-2 text-xs">
                    {JSON.stringify(rule.condition, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </div>

        <FormWithToast action={createAction} className="card" submitLabel="Add rule" buttonClassName="btn-primary w-full">
          <h2 className="mb-4 text-lg font-medium">New rule</h2>
          <label className="label">Name</label>
          <input name="name" required className="input mb-4" placeholder="Block non-BJ" />
          <label className="label">Action</label>
          <select name="action" className="input mb-4">
            <option value="BLOCK">BLOCK</option>
            <option value="ALLOW">ALLOW</option>
            <option value="MANUAL_REVIEW">MANUAL_REVIEW</option>
          </select>
          <label className="label">Priority (higher runs first)</label>
          <input name="priority" type="number" defaultValue={0} className="input mb-4" />
          <label className="label">Condition (JSON)</label>
          <textarea name="condition" rows={8} className="input mb-2 font-mono text-xs" defaultValue={EXAMPLE_CONDITION} />
          <p className="mb-4 text-xs text-slate-500">
            Fields: confidence, status, country, gpsCountry, ipCountry, requiredCountry, vpn, proxy, tor, datacenter,
            mockLocation, mockLocationStatus, deviceIntegrity, gpsAccuracyMeters. Operators: eq, ne, gt, gte, lt, lte,
            in, not_in. Combine with {'{ and: [...] }'}, {'{ or: [...] }'}, {'{ not: {...} }'}.
          </p>
        </FormWithToast>
      </div>
    </div>
  );
}
