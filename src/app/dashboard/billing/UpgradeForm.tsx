'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createUpgradePayment, type UpgradeFormState } from './actions';
import { PAYABLE_PLANS, formatXof } from '@/lib/billing';

const initialState: UpgradeFormState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Création du paiement…' : label}
    </button>
  );
}

export function UpgradeForm({ defaultPlan }: { defaultPlan: string }) {
  const [state, formAction] = useFormState(createUpgradePayment, initialState);

  return (
    <form action={formAction} className="card max-w-md space-y-4">
      <h2 className="text-lg font-medium">Passer à un plan supérieur</h2>
      <p className="text-xs text-slate-500">
        Paiement sécurisé par Mobile Money ou carte bancaire via Verzapay. Vous serez redirigé vers une page de
        paiement sécurisée.
      </p>

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <div>
        <label className="label">Plan</label>
        <select name="plan" defaultValue={defaultPlan} className="input">
          {PAYABLE_PLANS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} — {formatXof(p.priceXof!)}/mois
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Nom du titulaire</label>
        <input name="customerName" required className="input" placeholder="Kofi Mensah" />
      </div>

      <div>
        <label className="label">Numéro de téléphone (requis, format international)</label>
        <input name="customerPhone" required className="input" placeholder="+22996000000" />
        <p className="mt-1 text-xs text-slate-500">
          Le pays et les moyens de paiement disponibles sont déduits automatiquement de ce numéro.
        </p>
      </div>

      <SubmitButton label="Continuer vers le paiement" />
    </form>
  );
}
