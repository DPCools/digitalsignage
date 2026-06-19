import { z } from 'zod';
import { router, tenantProcedure, adminProcedure } from '../init';
import { TRPCError } from '@trpc/server';
import {
  ALLOWED_MIMES, MIME_TO_CONTENT_TYPE, getMaxSize, getPresignedUploadUrl, getPublicUrl, getMinio
} from '@/lib/minio';
import { transcodeVideo } from '@/lib/transcode';

function extractMinioKey(url: string): string | null {
  const base = `${process.env.MINIO_PUBLIC_URL}/${process.env.MINIO_BUCKET}/`;
  return url.startsWith(base) ? decodeURIComponent(url.slice(base.length)) : null;
}

export const contentRouter = router({
  list: tenantProcedure
    .input(z.object({
      type: z.enum(['IMAGE', 'VIDEO', 'HTML_TEMPLATE', 'RSS_FEED', 'PDF']).optional(),
      status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(ctx.session.user.role);
      // Non-admins always see only APPROVED items regardless of filter
      const statusFilter = input.status && isAdmin ? input.status : 'APPROVED';
      const items = await ctx.db.contentItem.findMany({
        where: {
          type: input.type,
          status: statusFilter,
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
      const item = await ctx.db.contentItem.create({
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

      // Transcode videos to H.264 Baseline + faststart for TV/Pi compatibility.
      // Runs in the background — returns the original URL immediately; screens get
      // the transcoded URL on their next config poll (~5 min) or on next push.
      if (type === 'VIDEO') {
        const itemId = item.id;
        const db = ctx.db;
        transcodeVideo(input.key, process.env.MINIO_BUCKET!, (url) =>
          db.contentItem.update({ where: { id: itemId }, data: { url } }).then(() => undefined)
        );
      }

      return item;
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

  createWebPage: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      url: z.string().url(),
      refreshInterval: z.number().int().min(1).nullable(),
      duration: z.number().int().min(1).default(30),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.contentItem.create({
        data: {
          name: input.name,
          type: 'WEB_PAGE',
          url: input.url,
          metadata: { refreshInterval: input.refreshInterval },
          status: 'APPROVED',
          duration: input.duration,
          fileSize: null,
          uploadedBy: ctx.session.user.id,
        },
      });
    }),

  createCctvGrid: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      streams: z.array(z.object({
        url: z.string().min(1).trim().refine((u) => {
          try { const p = new URL(u); return p.protocol === 'http:' || p.protocol === 'https:'; }
          catch { return false; }
        }, { message: 'Stream URL must use http or https' }),
        label: z.string().optional(),
      })).min(1).max(4),
      duration: z.number().int().min(1).default(30),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.contentItem.create({
        data: {
          name: input.name,
          type: 'CCTV_GRID',
          url: '',
          metadata: { streams: input.streams },
          status: 'APPROVED',
          duration: input.duration,
          fileSize: null,
          uploadedBy: ctx.session.user.id,
        },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.contentItem.findUnique({ where: { id: input.id } });
      if (!item) throw new TRPCError({ code: 'NOT_FOUND' });
      // Remove all FK references before deleting the content item
      await ctx.db.playlistItem.deleteMany({ where: { contentItemId: input.id } });
      await ctx.db.impression.deleteMany({ where: { contentItemId: input.id } });
      await ctx.db.contentItem.delete({ where: { id: input.id } });
      // Best-effort object cleanup — don't fail if object already gone
      try {
        const key = extractMinioKey(item.url);
        if (key) await getMinio().removeObject(process.env.MINIO_BUCKET!, key);
      } catch {
        // Log silently — DB row is already deleted, orphaned object is preferable to a 500
      }
      return { ok: true };
    }),
});
