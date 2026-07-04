import { z } from 'zod';
import { router, adminProcedure } from '../init';
import { TRPCError } from '@trpc/server';

export const recipientListsRouter = router({
  list: adminProcedure.query(({ ctx }) =>
    ctx.db.recipientList.findMany({ orderBy: { name: 'asc' } })
  ),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      emails: z.array(z.string().email()).default([]),
    }))
    .mutation(({ ctx, input }) => ctx.db.recipientList.create({ data: input })),

  update: adminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      emails: z.array(z.string().email()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await ctx.db.recipientList.findUnique({ where: { id } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.db.recipientList.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.recipientList.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.db.recipientList.delete({ where: { id: input.id } });
    }),
});
