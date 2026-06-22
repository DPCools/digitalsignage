// Required environment variables (add to your deployment secrets — do NOT put in .env):
//   VAPID_SUBJECT    — e.g. "mailto:admin@example.com"
//   VAPID_PUBLIC_KEY — VAPID public key (base64url)
//   VAPID_PRIVATE_KEY — VAPID private key (base64url)

import webpush from 'web-push';
import { publicClient } from '@signflow/db';

let configured = false;
function getWebPush() {
  if (!configured) {
    if (!process.env.VAPID_SUBJECT || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      throw new Error('VAPID_SUBJECT, VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY must all be set');
    }
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
    configured = true;
  }
  return webpush;
}

export async function sendPushToOrg(
  orgSlug: string,
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  const org = await publicClient.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true },
  });
  if (!org) return;

  const subs = await publicClient.pushSubscription.findMany({
    where: {
      user: {
        orgId: org.id,
        role: { in: ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER'] },
      },
    },
  });
  if (subs.length === 0) return;

  const wp = getWebPush();
  const message = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await wp.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message,
        );
      } catch (err: unknown) {
        // 404/410 = subscription expired or deleted; remove it
        if (
          typeof err === 'object' &&
          err !== null &&
          'statusCode' in err &&
          [404, 410].includes((err as { statusCode: number }).statusCode)
        ) {
          try {
            await publicClient.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
          } catch (cleanupErr) {
            console.error('[push] failed to delete stale subscription:', cleanupErr);
          }
        }
      }
    }),
  );
}
