import { z } from 'zod';
import { router, adminProcedure } from '../init';

export const auditRouter = router({
  list: adminProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(100).default(50),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.auditLog.findMany({
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
      });

      let nextCursor: string | undefined;
      if (rows.length > input.limit) {
        nextCursor = rows.pop()!.id;
      }

      return { logs: rows, nextCursor };
    }),
});
