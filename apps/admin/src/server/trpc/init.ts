import { initTRPC, TRPCError } from '@trpc/server';
import { auth } from '@/server/auth';
import { getTenantClient, publicClient } from '@signflow/db';
import type { TenantPrismaClient } from '@signflow/db';
import { ZodError } from 'zod';

export interface TRPCContext {
  session: {
    user: {
      id: string;
      email: string;
      name?: string;
      role: string;
      orgId: string;
      orgSlug: string;
    };
  } | null;
  db: TenantPrismaClient | null;
  publicDb: typeof publicClient;
  orgSlug: string | null;
}

export async function createTRPCContext(): Promise<TRPCContext> {
  const session = await auth();
  return {
    session: session as TRPCContext['session'],
    db: session?.user.orgSlug ? getTenantClient(session.user.orgSlug) : null,
    publicDb: publicClient,
    orgSlug: session?.user.orgSlug ?? null,
  };
}

const t = initTRPC.context<TRPCContext>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

export const tenantProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  if (!ctx.db || !ctx.orgSlug) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'No tenant DB' });
  }
  return next({ ctx: { ...ctx, session: ctx.session, db: ctx.db, orgSlug: ctx.orgSlug } });
});

export const adminProcedure = tenantProcedure.use(({ ctx, next }) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(ctx.session.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx });
});
