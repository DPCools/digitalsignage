import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import { router, adminProcedure } from '../init';
import { TRPCError } from '@trpc/server';

// Generate API key: sgk_ prefix + 32 random hex characters = 68 chars total
function generateRawKey(): string {
  return `sgk_${randomBytes(32).toString('hex')}`;
}

// Extract key prefix: first 12 characters (sgk_ + 8 hex chars)
function getKeyPrefix(rawKey: string): string {
  return rawKey.slice(0, 12);
}

// Hash key using SHA-256
function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

export const apiKeysRouter = router({
  list: adminProcedure.query(({ ctx }) =>
    ctx.db.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
      },
    })
  ),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      expiresAt: z.string().datetime().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const rawKey = generateRawKey();
      const keyPrefix = getKeyPrefix(rawKey);
      const keyHash = hashKey(rawKey);

      const apiKey = await ctx.db.apiKey.create({
        data: {
          name: input.name,
          keyPrefix,
          keyHash,
          createdBy: ctx.session.user.email,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
          lastUsedAt: true,
          expiresAt: true,
          revokedAt: true,
        },
      });

      return {
        ...apiKey,
        rawKey, // Return raw key only once on creation
      };
    }),

  revoke: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.db.apiKey.update({
          where: { id: input.id },
          data: { revokedAt: new Date() },
          select: {
            id: true,
            name: true,
            keyPrefix: true,
            createdBy: true,
            createdAt: true,
            updatedAt: true,
            lastUsedAt: true,
            expiresAt: true,
            revokedAt: true,
          },
        });
      } catch (error: unknown) {
        const e = error as { code?: string };
        if (e.code === 'P2025') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'API key not found' });
        }
        throw error;
      }
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.apiKey.delete({ where: { id: input.id } });
        return { ok: true };
      } catch (error: unknown) {
        const e = error as { code?: string };
        if (e.code === 'P2025') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'API key not found' });
        }
        throw error;
      }
    }),
});
