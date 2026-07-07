import { z } from 'zod';
import { router, tenantProcedure, adminProcedure } from '../init';
import { getMinio } from '@/lib/minio';
import { randomUUID } from 'crypto';

const AUDIO_MIMES: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3':  'mp3',
  'audio/wav':  'wav',
  'audio/ogg':  'ogg',
  'audio/aac':  'aac',
  'audio/mp4':  'm4a',
};

export const alertSoundsRouter = router({
  list: tenantProcedure.query(({ ctx }) =>
    ctx.db.alertSound.findMany({ orderBy: { createdAt: 'desc' } })
  ),

  presignUpload: adminProcedure
    .input(z.object({
      mimeType: z.string().refine((m) => m in AUDIO_MIMES, { message: 'Unsupported audio type' }),
    }))
    .mutation(async ({ ctx, input }) => {
      const ext = AUDIO_MIMES[input.mimeType];
      const key = `uploads/${ctx.orgSlug}/sounds/${Date.now()}-${randomUUID()}.${ext}`;
      const minio = getMinio();
      const rawUrl = await minio.presignedPutObject(process.env.MINIO_BUCKET!, key, 15 * 60);
      const internalBase = `http${process.env.MINIO_USE_SSL === 'true' ? 's' : ''}://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT ?? '9000'}`;
      const uploadUrl = rawUrl.replace(internalBase, process.env.MINIO_PUBLIC_URL!);
      const publicUrl = `${process.env.MINIO_PUBLIC_URL}/${process.env.MINIO_BUCKET}/${key}`;
      return { uploadUrl, key, publicUrl };
    }),

  confirmUpload: adminProcedure
    .input(z.object({
      key: z.string().min(1),
      name: z.string().min(1).max(80),
      url: z.string().url(),
    }))
    .mutation(({ ctx, input }) =>
      ctx.db.alertSound.create({
        data: {
          name: input.name,
          key: input.key,
          url: input.url,
          createdBy: ctx.session.user.id,
        },
      })
    ),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sound = await ctx.db.alertSound.findUnique({ where: { id: input.id } });
      if (!sound) return;
      await ctx.db.alertSound.delete({ where: { id: input.id } });
      try {
        await getMinio().removeObject(process.env.MINIO_BUCKET!, sound.key);
      } catch { /* best-effort */ }
    }),
});
