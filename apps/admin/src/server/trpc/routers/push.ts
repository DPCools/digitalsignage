import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../init';
import { publicClient } from '@signflow/db';

export const pushRouter = router({
  subscribe: protectedProcedure
    .input(z.object({
      endpoint: z.string().url(),
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await publicClient.pushSubscription.findUnique({
        where: { endpoint: input.endpoint },
        select: { userId: true },
      });
      if (existing && existing.userId !== ctx.session!.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      await publicClient.pushSubscription.upsert({
        where: { endpoint: input.endpoint },
        update: { p256dh: input.p256dh, auth: input.auth },
        create: {
          userId: ctx.session!.user.id,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
        },
      });
    }),

  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      await publicClient.pushSubscription.deleteMany({
        where: { endpoint: input.endpoint, userId: ctx.session!.user.id },
      });
    }),
});
