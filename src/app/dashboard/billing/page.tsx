import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { PLAN_CATALOG, formatXof } from '@/lib/billing';
import { VERZAPAY_COUNTRIES } from '@/lib/verzapayCountries';
import { UpgradeForm } from './UpgradeForm';

const PAYMENT_STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
};

export default async function BillingPage() {
  const user = await getCurrentUser();
  const [org, payments] = await Promise.all([
    prisma.organization.findUnique({ where: { id: user!.organizationId } }),
    prisma.payment.findMany({
      where: { organizationId: user!.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  const currentPlanIndex = PLAN_CATALOG.findIndex((p) => p.id === org?.plan);
  const nextPlan = PLAN_CATALOG[currentPlanIndex + 1];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-slate-500">
          Plan actuel : <strong>{org?.plan}</strong>. Email de facturation : {org?.billingEmail ?? '—'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {PLAN_CATALOG.map((plan) => (
          <div key={plan.id} className={`card ${org?.plan === plan.id ? 'ring-2 ring-brand-500' : ''}`}>
            <p className="text-sm font-medium text-slate-500">{plan.label}</p>
            <p className="mt-1 text-2xl font-semibold">
              {plan.priceXof === null ? 'Sur devis' : plan.priceXof === 0 ? 'Gratuit' : formatXof(plan.priceXof)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {plan.quota === Infinity ? 'Volume illimité' : `${plan.quota.toLocaleString()} vérifications/mois`}
            </p>
            <ul className="mt-3 space-y-1 text-xs text-slate-600">
              {plan.features.map((f) => (
                <li key={f}>· {f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <UpgradeForm defaultPlan={nextPlan?.id ?? 'STARTER'} />

        <div className="card">
          <h2 className="mb-4 text-lg font-medium">Historique des paiements</h2>
          {payments.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun paiement pour le moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-2">Plan visé</th>
                    <th className="pb-2">Montant</th>
                    <th className="pb-2">Statut</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2">{p.targetPlan}</td>
                      <td className="py-2">
                        {new Intl.NumberFormat('fr-FR').format(p.amount)} {p.currency}
                      </td>
                      <td className="py-2">
                        <span className={`badge ${PAYMENT_STATUS_STYLE[p.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-2 text-slate-500">{p.createdAt.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-1 text-lg font-medium">Pays et moyens de paiement Verzapay</h2>
        <p className="mb-4 text-xs text-slate-500">
          Le paiement en libre-service ci-dessus n'est activé qu'en XOF/XAF pour le moment. Les autres marchés
          couverts par Verzapay peuvent nous contacter pour un abonnement adapté à leur devise.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2">Pays</th>
                <th className="pb-2">Indicatif</th>
                <th className="pb-2">Devise</th>
                <th className="pb-2">Moyens de paiement</th>
              </tr>
            </thead>
            <tbody>
              {VERZAPAY_COUNTRIES.map((c) => (
                <tr key={`${c.country}-${c.currency}`} className="border-b border-slate-100 last:border-0">
                  <td className="py-2">{c.country}</td>
                  <td className="py-2 font-mono text-xs">{c.dialCode}</td>
                  <td className="py-2">{c.currency}</td>
                  <td className="py-2 text-xs text-slate-500">
                    {c.paymentMethods.length === 0
                      ? '—'
                      : c.paymentMethods.map((m) => (m === 'card' ? 'Carte bancaire' : 'Mobile Money')).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Paiements traités par{' '}
        <a href="https://www.verzapay.com" target="_blank" rel="noreferrer" className="underline">
          Verzapay
        </a>
        . Verzapay n'est pas une banque - les opérations sont exécutées via des partenaires de paiement agréés.
      </p>
    </div>
  );
}
