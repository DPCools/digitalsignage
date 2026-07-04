import { z } from 'zod';
import { router, tenantProcedure, adminProcedure } from '../init';
import { TRPCError } from '@trpc/server';

export const screensRouter = router({
  list: tenantProcedure.query(({ ctx }) =>
    ctx.db.screen.findMany({
      include: { group: true },
      orderBy: { createdAt: 'desc' },
    })
  ),

  health: tenantProcedure.query(async ({ ctx }) => {
    const screens = await ctx.db.screen.findMany({
      include: {
        group:           { select: { name: true } },
        currentPlaylist: { select: { name: true } },
        heartbeats: {
          take: 1,
          orderBy: { timestamp: 'desc' },
          select: { contentId: true, timestamp: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Batch-fetch content item names for whatever is currently playing
    const contentIds = [
      ...new Set(
        screens.map((s) => s.heartbeats[0]?.contentId).filter((id): id is string => !!id)
      ),
    ];
    const contentItems = contentIds.length
      ? await ctx.db.contentItem.findMany({
          where: { id: { in: contentIds } },
          select: { id: true, name: true },
        })
      : [];
    const contentMap = Object.fromEntries(contentItems.map((c) => [c.id, c.name]));

    return screens.map((s) => ({
      id:              s.id,
      name:            s.name,
      group:           s.group?.name ?? null,
      orientation:     s.orientation,
      lastHeartbeat:   s.lastHeartbeat,
      lastSnapshot:    s.lastSnapshot,
      currentPlaylist: s.currentPlaylist?.name ?? null,
      currentContent:  s.heartbeats[0]?.contentId
        ? (contentMap[s.heartbeats[0].contentId] ?? null)
        : null,
    }));
  }),

  get: tenantProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const screen = await ctx.db.screen.findUnique({
        where: { id: input.id },
        include: { group: true, heartbeats: { take: 20, orderBy: { timestamp: 'desc' } } },
      });
      if (!screen) throw new TRPCError({ code: 'NOT_FOUND' });
      return screen;
    }),

  register: adminProcedure
    .input(z.object({ code: z.string().length(6), name: z.string().min(1), groupId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const pairing = await ctx.publicDb.pairingCode.findUnique({
        where: { code: input.code },
      });
      if (!pairing || pairing.orgSlug) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or already-used pairing code' });
      }
      if (pairing.expiresAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pairing code expired' });
      }

      const screen = await ctx.db.screen.create({
        data: {
          name: input.name,
          uniqueCode: input.code,
          groupId: input.groupId,
        },
      });

      // Atomic claim: updateMany checks orgSlug is still null to prevent TOCTOU race
      const claimed = await ctx.publicDb.pairingCode.updateMany({
        where: { code: input.code, orgSlug: null },
        data: { orgSlug: ctx.orgSlug, screenId: screen.id },
      });

      if (claimed.count === 0) {
        await ctx.db.screen.delete({ where: { id: screen.id } });
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pairing code already used' });
      }

      return screen;
    }),

  update: adminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      groupId: z.string().nullable().optional(),
      orientation: z.enum(['LANDSCAPE', 'PORTRAIT']).optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.screen.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.impression.deleteMany({ where: { screenId: input.id } });
      return ctx.db.screen.delete({ where: { id: input.id } });
    }),

  sendCommand: adminProcedure
    .input(z.object({
      screenId: z.string(),
      command: z.enum(['reload', 'screenshot', 'playlist_update']),
    }))
    .mutation(async ({ ctx, input }) => {
      const { emitToScreen } = await import('@/server/socket');

      if (input.command === 'screenshot') {
        // Write a Redis flag (60 s TTL).  The player polls /api/player/snapshot-trigger
        // every 5 s and atomically consumes this flag — no socket timing dependency.
        const { getRedis } = await import('@/lib/redis');
        await getRedis().set(`snap:${ctx.orgSlug}:${input.screenId}`, '1', 'EX', 60);
        // Best-effort immediate delivery via socket in case the player is already connected.
        await emitToScreen(ctx.orgSlug, input.screenId, 'screen:screenshot');
      } else {
        const event = input.command === 'reload' ? 'screen:reload' : 'playlist:update';
        await emitToScreen(ctx.orgSlug, input.screenId, event);
      }

      return { ok: true };
    }),
});
