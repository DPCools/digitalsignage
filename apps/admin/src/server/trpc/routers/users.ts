import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { randomBytes } from 'crypto';
import { router, adminProcedure } from '../init';
import { writeAuditLog } from '@/lib/audit';

const ROLE_OPTIONS = ['ADMIN', 'CONTENT_MANAGER', 'VIEWER'] as const;

export const usersRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const [users, invites] = await Promise.all([
      ctx.publicDb.user.findMany({
        where: { orgId: ctx.session.user.orgId },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      ctx.publicDb.invite.findMany({
        where: {
          orgId: ctx.session.user.orgId,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true, email: true, name: true, role: true,
          token: true, createdAt: true, expiresAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { users, invites };
  }),

  invite: adminProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().min(1).max(100).optional(),
      role: z.enum(ROLE_OPTIONS),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.publicDb.user.findUnique({ where: { email: input.email } });
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'This email is already a member' });
      }

      const pendingInvite = await ctx.publicDb.invite.findFirst({
        where: {
          email: input.email,
          orgId: ctx.session.user.orgId,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (pendingInvite) {
        throw new TRPCError({ code: 'CONFLICT', message: 'A pending invite already exists for this email' });
      }

      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await ctx.publicDb.invite.create({
        data: {
          token,
          email: input.email,
          name: input.name,
          role: input.role,
          orgId: ctx.session.user.orgId,
          invitedBy: ctx.session.user.id,
          expiresAt,
        },
      });

      await writeAuditLog(ctx.db, {
        action: 'user.invited',
        actorId: ctx.session.user.id,
        actorName: ctx.session.user.email,
        targetName: input.email,
        metadata: { role: input.role },
      });

      return { token };
    }),

  updateRole: adminProcedure
    .input(z.object({
      userId: z.string(),
      role: z.enum(ROLE_OPTIONS),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.publicDb.user.findFirst({
        where: { id: input.userId, orgId: ctx.session.user.orgId },
      });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' });
      if (user.id === ctx.session.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot change your own role' });
      }

      await ctx.publicDb.user.update({
        where: { id: input.userId },
        data: { role: input.role },
      });

      await writeAuditLog(ctx.db, {
        action: 'user.role_changed',
        actorId: ctx.session.user.id,
        actorName: ctx.session.user.email,
        targetId: user.id,
        targetName: user.email,
        metadata: { from: user.role, to: input.role },
      });

      return { ok: true as const };
    }),

  remove: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.publicDb.user.findFirst({
        where: { id: input.userId, orgId: ctx.session.user.orgId },
      });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' });
      if (user.id === ctx.session.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot remove yourself' });
      }

      await ctx.publicDb.user.delete({ where: { id: input.userId } });

      await writeAuditLog(ctx.db, {
        action: 'user.removed',
        actorId: ctx.session.user.id,
        actorName: ctx.session.user.email,
        targetId: user.id,
        targetName: user.email,
      });

      return { ok: true as const };
    }),

  revokeInvite: adminProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.publicDb.invite.findFirst({
        where: { id: input.inviteId, orgId: ctx.session.user.orgId },
      });
      if (!invite) throw new TRPCError({ code: 'NOT_FOUND' });

      await ctx.publicDb.invite.delete({ where: { id: input.inviteId } });

      await writeAuditLog(ctx.db, {
        action: 'invite.revoked',
        actorId: ctx.session.user.id,
        actorName: ctx.session.user.email,
        targetName: invite.email,
      });

      return { ok: true as const };
    }),
});
