import cron from 'node-cron';
import { publicClient, getTenantClient } from '@signflow/db';
import { emitToOrg, emitToScreen } from '@/server/socket';

let started = false;

export function startCronJobs() {
  if (started) return;
  started = true;

  // Every minute: expire emergency alerts and mark screens offline if no heartbeat for 2 minutes
  cron.schedule('* * * * *', async () => {
    try {
      const orgs = await publicClient.organization.findMany({ select: { slug: true } });

      await Promise.allSettled(
        orgs.map(async ({ slug }) => {
          try {
            const db = getTenantClient(slug);

            // Deactivate expired alerts
            const expired = await db.emergencyAlert.findMany({
              where: { isActive: true, expiresAt: { lt: new Date() } },
            });
            for (const alert of expired) {
              await db.emergencyAlert.update({ where: { id: alert.id }, data: { isActive: false } });
              if (alert.screenIds.length === 0) {
                emitToOrg(slug, 'alert:clear');
              } else {
                alert.screenIds.forEach((id) => emitToScreen(slug, id, 'alert:clear'));
              }
            }

            // Mark screens offline if heartbeat older than 2 minutes
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
            await db.screen.updateMany({
              where: { isOnline: true, lastHeartbeat: { lt: twoMinutesAgo } },
              data: { isOnline: false },
            });
          } catch (err) {
            console.error(`[cron] tick failed for org ${slug}:`, err);
          }
        })
      );
    } catch (err) {
      console.error('[cron] tick failed to load orgs:', err);
    }
  });
}
