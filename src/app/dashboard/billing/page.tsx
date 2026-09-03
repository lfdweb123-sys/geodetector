import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

const PLANS = [
  { id: 'FREE', label: 'Free', price: '$0', quota: '1,000 verifications / mo', features: ['1 project', 'Community support'] },
  { id: 'STARTER', label: 'Starter', price: '$49/mo', quota: '20,000 verifications / mo', features: ['5 projects', 'Email support', 'Webhooks'] },
  { id: 'PRO', label: 'Pro', price: '$199/mo', quota: '200,000 verifications / mo', features: ['Unlimited projects', 'Priority support', 'Custom rules'] },
  { id: 'BUSINESS', label: 'Business', price: '$799/mo', quota: '2,000,000 verifications / mo', features: ['SSO', 'SLA', 'Dedicated IP intel provider'] },
  { id: 'ENTERPRISE', label: 'Enterprise', price: 'Custom', quota: 'Custom', features: ['Custom contracts', 'On-prem/VPC deployment', 'Dedicated support'] },
];

export default async function BillingPage() {
  const user = await getCurrentUser();
  const org = await prisma.organization.findUnique({ where: { id: user!.organizationId } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-slate-500">Current plan: <strong>{org?.plan}</strong>. Billing email: {org?.billingEmail ?? '—'}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {PLANS.map((plan) => (
          <div key={plan.id} className={`card ${org?.plan === plan.id ? 'ring-2 ring-brand-500' : ''}`}>
            <p className="text-sm font-medium text-slate-500">{plan.label}</p>
            <p className="mt-1 text-2xl font-semibold">{plan.price}</p>
            <p className="mt-1 text-xs text-slate-500">{plan.quota}</p>
            <ul className="mt-3 space-y-1 text-xs text-slate-600">
              {plan.features.map((f) => (
                <li key={f}>· {f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        Plan changes and overage billing require a payment provider integration (e.g. Stripe) - not wired up in this
        environment. Usage against the active plan's quota is tracked on the Usage page regardless.
      </p>
    </div>
  );
}
