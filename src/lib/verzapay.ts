// Minimal server-side client for the Verzapay payments API
// (https://www.verzapay.com/api/v1). Never import this from a client
// component - it reads the secret key from the server-only
// VERZAPAY_SECRET_KEY environment variable and must only ever be called
// from a Server Action or Route Handler.

const VERZAPAY_BASE_URL = 'https://www.verzapay.com/api/v1';

const ERROR_MESSAGES: Record<number, string> = {
  400: "Requête invalide - vérifiez le montant et le numéro de téléphone.",
  401: 'Clé API Verzapay invalide ou manquante (VERZAPAY_SECRET_KEY).',
  403: "KYC non approuvé sur ce compte Verzapay, ou méthode de paiement indisponible pour ce pays.",
  404: 'Ressource introuvable.',
  429: 'Trop de requêtes envoyées à Verzapay - réessayez dans quelques instants.',
  500: 'Erreur serveur Verzapay - réessayez plus tard.',
};

export class VerzapayError extends Error {
  constructor(
    public readonly status: number,
    message?: string,
  ) {
    super(message ?? ERROR_MESSAGES[status] ?? `Verzapay a renvoyé une erreur (HTTP ${status}).`);
    this.name = 'VerzapayError';
  }
}

function secretKey(): string {
  const key = process.env.VERZAPAY_SECRET_KEY;
  if (!key) throw new Error('VERZAPAY_SECRET_KEY is not configured');
  return key;
}

export interface CreateVerzapayPaymentParams {
  amount: number;
  currency: string;
  description: string;
  customerName: string;
  /** Required by Verzapay - the customer's country (and therefore the available payment rails) is deduced from this. */
  customerPhone: string;
}

export interface VerzapayPayment {
  id: string;
  status: string;
  amount: number;
  currency: string;
  checkout_url: string;
}

export async function createVerzapayPayment(params: CreateVerzapayPaymentParams): Promise<VerzapayPayment> {
  let res: Response;
  try {
    res = await fetch(`${VERZAPAY_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secretKey()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency,
        description: params.description,
        customer_name: params.customerName,
        customer_phone: params.customerPhone,
      }),
      cache: 'no-store',
    });
  } catch (err) {
    throw new VerzapayError(0, `Impossible de joindre Verzapay: ${(err as Error).message}`);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new VerzapayError(res.status, body?.message);
  }

  return (await res.json()) as VerzapayPayment;
}
