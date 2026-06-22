import { z } from 'zod';
import { router, tenantProcedure, adminProcedure } from '../init';
import { sanitizeHtml } from '@/lib/sanitize';
import { TRPCError } from '@trpc/server';

const variableSchema = z.array(z.object({
  name: z.string(),
  type: z.enum(['text', 'image', 'color', 'number']),
  default: z.unknown().optional(),
}));

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
      variables: variableSchema.default([]),
    }))
    .mutation(({ ctx, input }) =>
      ctx.db.template.create({
        data: {
          name: input.name,
          html: sanitizeHtml(input.html),
          css: input.css ?? null,
          variables: input.variables as unknown as Parameters<typeof ctx.db.template.create>[0]['data']['variables'],
          createdBy: ctx.session.user.id,
        },
      })
    ),

  update: tenantProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      html: z.string().optional(),
      css: z.string().nullable().optional(),
      variables: variableSchema.optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, html, variables, ...rest } = input;
      return ctx.db.template.update({
        where: { id },
        data: {
          ...rest,
          html: html !== undefined ? sanitizeHtml(html) : undefined,
          variables: variables !== undefined
            ? variables as unknown as Parameters<typeof ctx.db.template.update>[0]['data']['variables']
            : undefined,
        },
      });
    }),

  instantiate: tenantProcedure
    .input(z.object({
      templateId: z.string(),
      name: z.string().min(1),
      variableValues: z.record(z.string()).default({}),
      duration: z.number().int().min(1).default(30),
    }))
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.template.findUnique({ where: { id: input.templateId } });
      if (!template) throw new TRPCError({ code: 'NOT_FOUND' });

      return ctx.db.contentItem.create({
        data: {
          name: input.name,
          type: 'HTML_TEMPLATE',
          url: '',
          templateId: input.templateId,
          metadata: { variableValues: input.variableValues },
          duration: input.duration,
          status: 'APPROVED',
          uploadedBy: ctx.session.user.id,
        },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.template.delete({ where: { id: input.id } })),
});
