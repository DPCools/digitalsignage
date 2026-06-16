import { z } from 'zod';
import { router, tenantProcedure, adminProcedure } from '../init';
import { TRPCError } from '@trpc/server';

export const playlistsRouter = router({
  list: tenantProcedure.query(({ ctx }) =>
    ctx.db.playlist.findMany({ include: { _count: { select: { items: true } } }, orderBy: { createdAt: 'desc' } })
  ),

  get: tenantProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const p = await ctx.db.playlist.findUnique({
        where: { id: input.id },
        include: { items: { include: { contentItem: true }, orderBy: { position: 'asc' } } },
      });
      if (!p) throw new TRPCError({ code: 'NOT_FOUND' });
      return p;
    }),

  create: tenantProcedure
    .input(z.object({ name: z.string().min(1), description: z.string().optional(), isDefault: z.boolean().default(false) }))
    .mutation(({ ctx, input }) =>
      ctx.db.playlist.create({ data: { ...input, createdBy: ctx.session.user.id } })
    ),

  update: tenantProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).optional(), description: z.string().optional(), isDefault: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      if (data.isDefault) {
        // Ensure only one default playlist per tenant
        await ctx.db.playlist.updateMany({ where: { isDefault: true, NOT: { id } }, data: { isDefault: false } });
      }
      return ctx.db.playlist.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.playlist.delete({ where: { id: input.id } })),

  addItem: tenantProcedure
    .input(z.object({
      playlistId: z.string(),
      contentItemId: z.string(),
      duration: z.number().min(1).default(10),
      transition: z.enum(['FADE', 'SLIDE_LEFT', 'SLIDE_RIGHT', 'ZOOM', 'NONE']).default('FADE'),
      zone: z.string().default('main'),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async (tx) => {
        const agg = await tx.playlistItem.aggregate({
          where: { playlistId: input.playlistId },
          _max: { position: true },
        });
        const position = (agg._max.position ?? -1) + 1;
        return tx.playlistItem.create({ data: { ...input, position }, include: { contentItem: true } });
      });
    }),

  removeItem: tenantProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.playlistItem.delete({ where: { id: input.id } })),

  reorderItems: tenantProcedure
    .input(z.object({
      playlistId: z.string(),
      itemIds: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(
        input.itemIds.map((id, position) =>
          // playlistId in where ensures items belong to this playlist (ownership + FK guard)
          ctx.db.playlistItem.update({ where: { id, playlistId: input.playlistId }, data: { position } })
        )
      );
      return { ok: true };
    }),

  updateItem: tenantProcedure
    .input(z.object({
      id: z.string(),
      duration: z.number().min(1).optional(),
      transition: z.enum(['FADE', 'SLIDE_LEFT', 'SLIDE_RIGHT', 'ZOOM', 'NONE']).optional(),
      zone: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.playlistItem.update({ where: { id }, data });
    }),
});
