import type { Plan } from '@prisma/client';

export interface PlanInfo {
  id: Plan;
  label: string;
  /** 0 = free, null = custom/contact sales (no self-serve payment). XOF has no minor unit - this is the whole-franc price. */
  priceXof: number | null;
  quota: number; // verifications/month, Infinity for unlimited
  features: string[];
}

export const PLAN_CATALOG: PlanInfo[] = [
  { id: 'FREE', label: 'Free', priceXof: 0, quota: 1000, features: ['1 projet', 'Support communautaire'] },
  {
    id: 'STARTER',
    label: 'Starter',
    priceXof: 15000,
    quota: 20000,
    features: ['5 projets', 'Support email', 'Webhooks'],
  },
  {
    id: 'PRO',
    label: 'Pro',
    priceXof: 60000,
    quota: 200000,
    features: ['Projets illimités', 'Support prioritaire', 'Règles personnalisées'],
  },
  {
    id: 'BUSINESS',
    label: 'Business',
    priceXof: 250000,
    quota: 2000000,
    features: ['SSO', 'SLA', "Fournisseur d'intelligence IP dédié"],
  },
  {
    id: 'ENTERPRISE',
    label: 'Enterprise',
    priceXof: null,
    quota: Infinity,
    features: ['Contrats sur mesure', 'Déploiement on-prem/VPC', 'Support dédié'],
  },
];

/** Plans a customer can pay for and self-upgrade into via Verzapay. */
export const PAYABLE_PLANS = PLAN_CATALOG.filter((p) => p.priceXof !== null && p.priceXof > 0);

export function planInfo(plan: Plan): PlanInfo {
  return PLAN_CATALOG.find((p) => p.id === plan) ?? PLAN_CATALOG[0]!;
}

export function formatXof(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' XOF';
}
