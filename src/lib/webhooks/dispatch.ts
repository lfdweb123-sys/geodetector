import { createHmac } from 'crypto';
import { prisma } from '../db';

export type WebhookEvent =
  | 'verification.completed'
  | 'verification.verified'
  | 'verification.suspicious'
  | 'verification.rejected';

function eventsForStatus(status: 'VERIFIED' | 'SUSPICIOUS' | 'UNVERIFIED'): WebhookEvent[] {
  const events: WebhookEvent[] = ['verification.completed'];
  if (status === 'VERIFIED') events.push('verification.verified');
  if (status === 'SUSPICIOUS') events.push('verification.suspicious');
  if (status === 'UNVERIFIED') events.push('verification.rejected');
  return events;
}

/**
 * Fires configured webhooks for a completed verification. Delivery is best-effort
 * and fire-and-forget from the caller's perspective (the API response is never
 * held up on a customer's endpoint) - every attempt (success or failure) is
 * recorded in `WebhookDelivery` so the dashboard can show delivery history and
 * a retry can be triggered later (e.g. from a Vercel Cron job).
 */
export async function dispatchWebhooks(params: {
  projectId: string;
  verificationId: string;
  status: 'VERIFIED' | 'SUSPICIOUS' | 'UNVERIFIED';
  decision: 'ACCEPT' | 'REJECT' | 'MANUAL_REVIEW';
  confidence: number;
}) {
  const webhooks = await prisma.webhook.findMany({ where: { projectId: params.projectId, enabled: true } });
  if (webhooks.length === 0) return;

  const firedEvents = eventsForStatus(params.status);

  for (const webhook of webhooks) {
    const matched = webhook.events.filter((e) => firedEvents.includes(e as WebhookEvent));
    for (const event of matched) {
      const payload = {
        event,
        verification_id: params.verificationId,
        decision: params.decision,
        confidence: params.confidence,
        timestamp: new Date().toISOString(),
      };
      const body = JSON.stringify(payload);
      const signature = createHmac('sha256', webhook.secret).update(body).digest('hex');

      const delivery = await prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          verificationId: params.verificationId,
          event,
          payload,
          attempts: 1,
          lastAttemptAt: new Date(),
        },
      });

      try {
        const res = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-geolock-signature': signature,
            'x-geolock-event': event,
          },
          body,
        });
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: { statusCode: res.status, delivered: res.ok },
        });
      } catch {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: { delivered: false },
        });
      }
    }
  }
}
