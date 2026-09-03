'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { Plan } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { PAYABLE_PLANS } from '@/lib/billing';
import { createVerzapayPayment, VerzapayError } from '@/lib/verzapay';
import { findCountryByPhone, isE164 } from '@/lib/verzapayCountries';
import { logAudit } from '@/lib/audit';

export interface UpgradeFormState {
  error?: string;
}

export async function createUpgradePayment(
  _prev: UpgradeFormState,
  formData: FormData,
): Promise<UpgradeFormState> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  if (user.role !== 'OWNER') {
    return { error: "Seul le propriétaire de l'organisation peut gérer la facturation." };
  }

  const planId = String(formData.get('plan') ?? '') as Plan;
  const plan = PAYABLE_PLANS.find((p) => p.id === planId);
  if (!plan || plan.priceXof === null) {
    return { error: 'Plan invalide.' };
  }

  const customerName = String(formData.get('customerName') ?? '').trim();
  const customerPhone = String(formData.get('customerPhone') ?? '').trim();

  if (!customerName) return { error: 'Le nom est requis.' };
  // Verzapay requires the customer's phone number - it deduces the country
  // (and therefore the payment rail) from it. Never optional.
  if (!customerPhone) return { error: 'Le numéro de téléphone est requis.' };
  if (!isE164(customerPhone)) {
    return { error: 'Numéro invalide - utilisez le format international, ex: +22996000000.' };
  }

  const country = findCountryByPhone(customerPhone);
  if (!country || country.paymentMethods.length === 0) {
    return {
      error: `Aucun moyen de paiement Verzapay actif pour ce numéro${country ? ` (${country.country})` : ''} pour le moment.`,
    };
  }
  if (country.currency !== 'XOF' && country.currency !== 'XAF') {
    return {
      error: `L'abonnement en libre-service n'est disponible qu'en XOF/XAF pour le moment (numéro détecté : ${country.country}, devise ${country.currency}). Contactez-nous pour ce marché.`,
    };
  }

  const org = await prisma.organization.findUnique({ where: { id: user.organizationId } });
  if (!org) return { error: 'Organisation introuvable.' };

  let payment;
  try {
    payment = await createVerzapayPayment({
      amount: plan.priceXof,
      currency: country.currency,
      description: `Abonnement GeoLock - Plan ${plan.label} - ${org.name}`,
      customerName,
      customerPhone,
    });
  } catch (err) {
    if (err instanceof VerzapayError) return { error: err.message };
    return { error: 'Erreur inattendue lors de la création du paiement.' };
  }

  await prisma.payment.create({
    data: {
      organizationId: org.id,
      verzapayPaymentId: payment.id,
      targetPlan: plan.id,
      amount: plan.priceXof,
      currency: country.currency,
      status: 'PENDING',
      checkoutUrl: payment.checkout_url,
      customerName,
      customerPhone,
    },
  });

  await logAudit({
    organizationId: org.id,
    userId: user.id,
    action: 'payment.created',
    targetType: 'Payment',
    targetId: payment.id,
    metadata: { plan: plan.id, amount: plan.priceXof, currency: country.currency },
  });

  revalidatePath('/dashboard/billing');
  redirect(payment.checkout_url);
}
