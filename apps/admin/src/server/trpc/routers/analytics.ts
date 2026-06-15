import { z } from 'zod';
import { router, tenantProcedure } from '../init';

export const analyticsRouter = router({
  summary: tenantProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.days * 86400000);
      const [totalImpressions, topContent, screenUptime] = await Promise.all([
        ctx.db.impression.count({ where: { playedAt: { gte: since } } }),
        ctx.db.impression.groupBy({
          by: ['contentItemId'],
          _count: { contentItemId: true },
          _sum: { durationMs: true },
          where: { playedAt: { gte: since } },
          orderBy: { _count: { contentItemId: 'desc' } },
          take: 10,
        }),
        ctx.db.screen.findMany({
          select: { id: true, name: true, isOnline: true, lastHeartbeat: true },
        }),
      ]);

      return { totalImpressions, topContent, screenUptime };
    }),

  impressionsByContent: tenantProcedure
    .input(z.object({ contentItemId: z.string(), days: z.number().default(7) }))
    .query(({ ctx, input }) => {
      const since = new Date(Date.now() - input.days * 86400000);
      return ctx.db.impression.findMany({
        where: { contentItemId: input.contentItemId, playedAt: { gte: since } },
        orderBy: { playedAt: 'desc' },
      });
    }),
});
