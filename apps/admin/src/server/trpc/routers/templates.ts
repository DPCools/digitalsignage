import { z } from 'zod';
import { router, tenantProcedure, adminProcedure } from '../init';
import { sanitizeHtml } from '@/lib/sanitize';
import { TRPCError } from '@trpc/server';

export const templatesRouter = router({
  list: tenantProcedure.query(({ ctx }) =>
    ctx.db.template.findMany({ orderBy: { createdAt: 'desc' } })
  ),

  get: tenantProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const t = await ctx.db.template.findUnique({ where: { id: input.id } });
      if (!t) throw new TRPCError({ code: 'NOT_FOUND' });
      return t;
    }),

  create: tenantProcedure
    .input(z.object({
      name: z.string().min(1),
      html: z.string(),
      css: z.string().optional(),
      variables: z.array(z.object({
        name: z.string(),
        type: z.enum(['text', 'image', 'color', 'number']),
        default: z.unknown().optional(),
      })).default([]),
    }))
    .mutation(({ ctx, input }) =>
      ctx.db.template.create({
        data: {
          ...input,
          html: sanitizeHtml(input.html),
          createdBy: ctx.session.user.id,
        },
      })
    ),

  update: tenantProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      html: z.string().optional(),
      css: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, html, ...rest } = input;
      return ctx.db.template.update({
        where: { id },
        data: { ...rest, html: html ? sanitizeHtml(html) : undefined },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.template.delete({ where: { id: input.id } })),
});
