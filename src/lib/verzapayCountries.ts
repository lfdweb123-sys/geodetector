// Snapshot of Verzapay's "Pays disponibles" table (docs, dernière
// synchronisation 03/09/2026). Hardcoded here on purpose - Verzapay's docs
// don't expose a public "list countries" endpoint, and this only gates a
// friendly client/server-side error message before calling the real API,
// which remains the final authority (it can reject a payment for reasons
// this table doesn't capture, e.g. temporary partner outages).
export interface VerzapayCountry {
  country: string;
  dialCode: string;
  currency: string;
  paymentMethods: ('card' | 'mobile_money')[];
  payoutAvailable: boolean;
}

export const VERZAPAY_COUNTRIES: VerzapayCountry[] = [
  { country: 'Bénin', dialCode: '+229', currency: 'XOF', paymentMethods: ['card', 'mobile_money'], payoutAvailable: true },
  { country: 'Burkina Faso', dialCode: '+226', currency: 'XOF', paymentMethods: [], payoutAvailable: true },
  { country: 'Cameroun', dialCode: '+237', currency: 'XAF', paymentMethods: ['card', 'mobile_money'], payoutAvailable: true },
  { country: "Côte d'Ivoire", dialCode: '+225', currency: 'XOF', paymentMethods: ['card', 'mobile_money'], payoutAvailable: true },
  { country: 'France', dialCode: '+33', currency: 'EUR', paymentMethods: [], payoutAvailable: false },
  { country: 'Gabon', dialCode: '+241', currency: 'XAF', paymentMethods: ['mobile_money'], payoutAvailable: true },
  { country: 'Ghana', dialCode: '+233', currency: 'GHS', paymentMethods: [], payoutAvailable: true },
  { country: 'Guinée', dialCode: '+224', currency: 'GNF', paymentMethods: ['mobile_money'], payoutAvailable: true },
  { country: 'Mali', dialCode: '+223', currency: 'XOF', paymentMethods: [], payoutAvailable: true },
  { country: 'Niger', dialCode: '+227', currency: 'XOF', paymentMethods: [], payoutAvailable: true },
  { country: 'Nigeria', dialCode: '+234', currency: 'NGN', paymentMethods: [], payoutAvailable: true },
  { country: 'RD Congo', dialCode: '+243', currency: 'CDF', paymentMethods: ['mobile_money'], payoutAvailable: true },
  { country: 'RD Congo (USD)', dialCode: '+243', currency: 'USD', paymentMethods: ['mobile_money'], payoutAvailable: true },
  { country: 'Rwanda', dialCode: '+250', currency: 'RWF', paymentMethods: ['mobile_money'], payoutAvailable: true },
  { country: 'Sénégal', dialCode: '+221', currency: 'XOF', paymentMethods: ['mobile_money'], payoutAvailable: true },
  { country: 'Togo', dialCode: '+228', currency: 'XOF', paymentMethods: [], payoutAvailable: true },
];

const DIAL_CODES_BY_LENGTH_DESC = [...new Set(VERZAPAY_COUNTRIES.map((c) => c.dialCode))].sort(
  (a, b) => b.length - a.length,
);

export function findCountryByPhone(phone: string): VerzapayCountry | null {
  const normalized = phone.trim();
  const dialCode = DIAL_CODES_BY_LENGTH_DESC.find((code) => normalized.startsWith(code));
  if (!dialCode) return null;
  // Prefer a country for that dial code that actually has an active payment method.
  const candidates = VERZAPAY_COUNTRIES.filter((c) => c.dialCode === dialCode);
  return candidates.find((c) => c.paymentMethods.length > 0) ?? candidates[0] ?? null;
}

export function isE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone.trim());
}

/** Whether a phone number's country currently has at least one active encaissement method on Verzapay. */
export function canReceivePayment(phone: string): boolean {
  const country = findCountryByPhone(phone);
  return !!country && country.paymentMethods.length > 0;
}
