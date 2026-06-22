import { z } from 'zod';
import { router, tenantProcedure } from '../init';

const daysInput = z.object({ days: z.number().min(1).max(90).default(30) });

export const analyticsRouter = router({
  summary: tenantProcedure
    .input(daysInput)
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

  byContent: tenantProcedure
    .input(daysInput)
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.days * 86400000);
      const rows = await ctx.db.impression.groupBy({
        by: ['contentItemId'],
        _count: { contentItemId: true },
        _sum:   { durationMs: true },
        where: { playedAt: { gte: since } },
        orderBy: { _count: { contentItemId: 'desc' } },
        take: 100,
      });

      const ids = rows.map((r) => r.contentItemId);
      const items = ids.length
        ? await ctx.db.contentItem.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, type: true },
          })
        : [];
      const itemMap = Object.fromEntries(items.map((i) => [i.id, i]));

      return rows.map((r) => ({
        contentItemId: r.contentItemId,
        name:     itemMap[r.contentItemId]?.name ?? '(deleted)',
        type:     itemMap[r.contentItemId]?.type ?? '',
        plays:    r._count.contentItemId,
        totalMs:  r._sum.durationMs ?? 0,
      }));
    }),

  byScreen: tenantProcedure
    .input(daysInput)
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.days * 86400000);
      const [rows, uniqueRows] = await Promise.all([
        ctx.db.impression.groupBy({
          by: ['screenId'],
          _count: { contentItemId: true },
          _sum:   { durationMs: true },
          where: { playedAt: { gte: since } },
          orderBy: { _count: { contentItemId: 'desc' } },
        }),
        ctx.db.impression.groupBy({
          by: ['screenId', 'contentItemId'],
          where: { playedAt: { gte: since } },
        }),
      ]);

      const screenIds = rows.map((r) => r.screenId);
      const screens = screenIds.length
        ? await ctx.db.screen.findMany({
            where: { id: { in: screenIds } },
            select: { id: true, name: true },
          })
        : [];
      const screenMap = Object.fromEntries(screens.map((s) => [s.id, s]));

      const uniquePerScreen: Record<string, number> = {};
      for (const r of uniqueRows) {
        uniquePerScreen[r.screenId] = (uniquePerScreen[r.screenId] ?? 0) + 1;
      }

      return rows.map((r) => ({
        screenId:      r.screenId,
        name:          screenMap[r.screenId]?.name ?? '(deleted)',
        plays:         r._count.contentItemId,
        uniqueContent: uniquePerScreen[r.screenId] ?? 0,
        totalMs:       r._sum.durationMs ?? 0,
      }));
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
