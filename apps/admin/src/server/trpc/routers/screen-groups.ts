import { z } from 'zod';
import { router, tenantProcedure, adminProcedure } from '../init';
import { TRPCError } from '@trpc/server';

const GROUP_TYPES = ['SITE', 'LOCATION', 'DEPARTMENT', 'OTHER'] as const;

export const screenGroupsRouter = router({
  list: tenantProcedure.query(({ ctx }) =>
    ctx.db.screenGroup.findMany({
      include: {
        _count: { select: { screens: true } },
        defaultPlaylist: { select: { id: true, name: true } },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    })
  ),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      type: z.enum(GROUP_TYPES).default('OTHER'),
      location: z.string().max(200).optional(),
      description: z.string().max(500).optional(),
      defaultPlaylistId: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => ctx.db.screenGroup.create({ data: input })),

  update: adminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      type: z.enum(GROUP_TYPES).optional(),
      location: z.string().max(200).nullable().optional(),
      description: z.string().max(500).nullable().optional(),
      defaultPlaylistId: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const group = await ctx.db.screenGroup.findUnique({ where: { id } });
      if (!group) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.db.screenGroup.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.db.screenGroup.findUnique({ where: { id: input.id } });
      if (!group) throw new TRPCError({ code: 'NOT_FOUND' });
      await ctx.db.screen.updateMany({ where: { groupId: input.id }, data: { groupId: null } });
      return ctx.db.screenGroup.delete({ where: { id: input.id } });
    }),

  // Replace the full membership of a group with the provided screenIds list
  setScreens: adminProcedure
    .input(z.object({
      groupId: z.string(),
      screenIds: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.db.screenGroup.findUnique({ where: { id: input.groupId } });
      if (!group) throw new TRPCError({ code: 'NOT_FOUND' });
      await ctx.db.$transaction([
        // Remove all screens currently in this group
        ctx.db.screen.updateMany({ where: { groupId: input.groupId }, data: { groupId: null } }),
        // Assign the new set
        ...(input.screenIds.length > 0
          ? [ctx.db.screen.updateMany({ where: { id: { in: input.screenIds } }, data: { groupId: input.groupId } })]
          : []),
      ]);
      return { ok: true };
    }),
});
