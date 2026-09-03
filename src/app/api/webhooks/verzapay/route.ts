import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { jsonOk } from '@/lib/apiResponse';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

/**
 * Verzapay webhook receiver. Configure this URL (must be HTTPS - see the
 * Verzapay docs) in the Verzapay Developer dashboard as:
 *   https://<your-deployment>.vercel.app/api/webhooks/verzapay
 *
 * SECURITY NOTE: Verzapay's published docs do not describe a webhook
 * signing secret or signature header, so unlike GeoLock's own outbound
 * webhooks (HMAC-signed, see src/lib/webhooks/dispatch.ts), this endpoint
 * has no cryptographic way to verify a request actually came from Verzapay.
 * Mitigation used here: the event is only ever allowed to move a *known,
 * still-PENDING* Payment row forward (matched by the id Verzapay itself
 * returned when we created the payment) - a forged request naming a random
 * id, or replaying an event for an already-settled payment, is a no-op. If
 * Verzapay later documents a signing secret, verify it here before trusting
 * the payload.
 */

type VerzapayEventType = 'payment.completed' | 'payment.failed' | 'payout.completed' | 'payout.failed';

interface VerzapayWebhookEvent {
  type: VerzapayEventType;
  // The exact payload shape isn't fully specified in Verzapay's docs beyond
  // `event.type` - we accept the payment id wherever a real payload is
  // likely to carry it.
  id?: string;
  data?: { id?: string };
  payment?: { id?: string };
}

function extractPaymentId(event: VerzapayWebhookEvent): string | null {
  return event.data?.id ?? event.payment?.id ?? event.id ?? null;
}

export async function POST(req: NextRequest) {
  let event: VerzapayWebhookEvent;
  try {
    event = await req.json();
  } catch {
    return jsonOk({ received: false, error: 'invalid JSON' }, 400);
  }

  const paymentId = extractPaymentId(event);

  switch (event.type) {
    case 'payment.completed': {
      if (!paymentId) break;
      const result = await prisma.payment.updateMany({
        where: { verzapayPaymentId: paymentId, status: 'PENDING' },
        data: { status: 'COMPLETED' },
      });
      if (result.count > 0) {
        const payment = await prisma.payment.findUnique({ where: { verzapayPaymentId: paymentId } });
        if (payment) {
          await prisma.organization.update({
            where: { id: payment.organizationId },
            data: { plan: payment.targetPlan },
          });
          await logAudit({
            organizationId: payment.organizationId,
            action: 'payment.completed',
            targetType: 'Payment',
            targetId: payment.id,
            metadata: { plan: payment.targetPlan, amount: payment.amount, currency: payment.currency },
          });
        }
      }
      break;
    }
    case 'payment.failed': {
      if (!paymentId) break;
      const payment = await prisma.payment.findUnique({ where: { verzapayPaymentId: paymentId } });
      if (payment && payment.status === 'PENDING') {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
        await logAudit({
          organizationId: payment.organizationId,
          action: 'payment.failed',
          targetType: 'Payment',
          targetId: payment.id,
        });
      }
      break;
    }
    case 'payout.completed':
    case 'payout.failed':
      // GeoLock's billing only ever collects payments (subscription upgrades) -
      // it never initiates Verzapay payouts, so these are acknowledged and ignored.
      break;
    default:
      break;
  }

  return jsonOk({ received: true });
}
