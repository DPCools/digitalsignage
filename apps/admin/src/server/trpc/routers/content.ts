import { z } from 'zod';
import { router, tenantProcedure, adminProcedure } from '../init';
import { TRPCError } from '@trpc/server';
import {
  ALLOWED_MIMES, MIME_TO_CONTENT_TYPE, getMaxSize, getPresignedUploadUrl, getPublicUrl
} from '@/lib/minio';

export const contentRouter = router({
  list: tenantProcedure
    .input(z.object({
      type: z.enum(['IMAGE', 'VIDEO', 'HTML_TEMPLATE', 'RSS_FEED', 'PDF']).optional(),
      status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.contentItem.findMany({
        where: {
          type: input.type,
          status: input.status ?? (process.env.CONTENT_APPROVAL_REQUIRED === 'true' ? 'APPROVED' : undefined),
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: 'desc' },
      });
      const hasMore = items.length > input.limit;
      return { items: items.slice(0, input.limit), nextCursor: hasMore ? items[input.limit].id : null };
    }),

  getUploadUrl: tenantProcedure
    .input(z.object({ filename: z.string(), mimeType: z.string(), size: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ALLOWED_MIMES.includes(input.mimeType)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'File type not allowed' });
      }
      if (input.size > getMaxSize(input.mimeType)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'File too large' });
      }
      return getPresignedUploadUrl(ctx.orgSlug!, input.mimeType);
    }),

  confirmUpload: tenantProcedure
    .input(z.object({
      name: z.string().max(256),
      key: z.string(),
      mimeType: z.string(),
      fileSize: z.number().int().positive(),
      duration: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate key is scoped to this org and contains no path traversal
      const expectedPrefix = `uploads/${ctx.orgSlug}/`;
      if (!input.key.startsWith(expectedPrefix) || input.key.includes('..')) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid upload key' });
      }
      // Re-validate MIME and size — never trust client values from confirmUpload alone
      if (!ALLOWED_MIMES.includes(input.mimeType)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'File type not allowed' });
      }
      if (input.fileSize > getMaxSize(input.mimeType)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'File too large' });
      }
      // Derive content type from validated MIME — don't accept client-supplied type enum
      const type = MIME_TO_CONTENT_TYPE[input.mimeType];
      if (!type) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot determine content type from MIME' });
      }
      return ctx.db.contentItem.create({
        data: {
          name: input.name,
          type,
          url: getPublicUrl(input.key),
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          duration: input.duration,
          uploadedBy: ctx.session.user.id,
          status: process.env.CONTENT_APPROVAL_REQUIRED === 'true' ? 'PENDING' : 'APPROVED',
        },
      });
    }),

  approve: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.contentItem.update({
        where: { id: input.id },
        data: { status: 'APPROVED', approvedBy: ctx.session.user.id },
      })
    ),

  reject: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.contentItem.update({
        where: { id: input.id },
        data: { status: 'REJECTED', approvedBy: ctx.session.user.id },
      })
    ),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.contentItem.delete({ where: { id: input.id } })
    ),
});
