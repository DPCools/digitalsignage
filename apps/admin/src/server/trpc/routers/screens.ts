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

      await ctx.publicDb.pairingCode.update({
        where: { code: input.code },
        data: { orgSlug: ctx.orgSlug, screenId: screen.id },
      });

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
    .mutation(({ ctx, input }) =>
      ctx.db.screen.delete({ where: { id: input.id } })
    ),

  sendCommand: adminProcedure
    .input(z.object({
      screenId: z.string(),
      command: z.enum(['reload', 'screenshot', 'playlist_update']),
    }))
    .mutation(async ({ ctx, input }) => {
      const { emitToScreen } = await import('@/server/socket');
      const event = input.command === 'reload' ? 'screen:reload'
        : input.command === 'screenshot' ? 'screen:screenshot'
        : 'playlist:update';
      await emitToScreen(ctx.orgSlug, input.screenId, event);
      return { ok: true };
    }),
});
