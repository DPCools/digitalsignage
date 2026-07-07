import { z } from 'zod';
import { router, tenantProcedure, adminProcedure } from '../init';
import { TRPCError } from '@trpc/server';
import { testAudioBridge } from '@/lib/audio-bridge';

export const audioBridgesRouter = router({
  list: tenantProcedure.query(({ ctx }) =>
    ctx.db.audioBridge.findMany({
      include: { group: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })
  ),

  create: adminProcedure
    .input(z.object({
      name:     z.string().min(1).max(100),
      groupId:  z.string(),
      host:     z.string().min(1),
      port:     z.number().int().min(1).max(65535).default(80),
      username: z.string().min(1),
      password: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.db.screenGroup.findUnique({ where: { id: input.groupId } });
      if (!group) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Group not found' });
      return ctx.db.audioBridge.create({ data: input });
    }),

  update: adminProcedure
    .input(z.object({
      id:       z.string(),
      name:     z.string().min(1).max(100).optional(),
      host:     z.string().min(1).optional(),
      port:     z.number().int().min(1).max(65535).optional(),
      username: z.string().min(1).optional(),
      password: z.string().optional(), // empty = keep existing
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, password, ...data } = input;
      const bridge = await ctx.db.audioBridge.findUnique({ where: { id } });
      if (!bridge) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.db.audioBridge.update({
        where: { id },
        data: { ...data, ...(password ? { password } : {}) },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bridge = await ctx.db.audioBridge.findUnique({ where: { id: input.id } });
      if (!bridge) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.db.audioBridge.delete({ where: { id: input.id } });
    }),

  test: adminProcedure
    .input(z.object({
      id:       z.string().optional(),
      host:     z.string().min(1),
      port:     z.number().int().min(1).max(65535).default(80),
      username: z.string().min(1),
      password: z.string(), // may be empty — fall back to stored password when id is given
      soundUrl: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      let password = input.password;
      if (!password && input.id) {
        const stored = await ctx.db.audioBridge.findUnique({ where: { id: input.id } });
        password = stored?.password ?? '';
      }
      if (!password) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing password' });

      const result = await testAudioBridge(input.soundUrl, input.host, input.port, input.username, password);
      if (!result.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
      return { ok: true };
    }),
});
