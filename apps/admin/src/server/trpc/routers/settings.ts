import { z } from 'zod';
import { randomUUID } from 'crypto';
import { router, tenantProcedure, adminProcedure } from '../init';
import { RTSP_HARD_CAP } from '@/lib/rtsp-semaphore';
import {
  getSoundUploadUrl as getMinioSoundUploadUrl,
  getSoundPublicUrl,
  isSoundKey,
  getMinio,
} from '@/lib/minio';

type SoundEntry = { id: string; name: string; key: string; url: string };

function parseSounds(raw: string | undefined): SoundEntry[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as SoundEntry[]; } catch { return []; }
}

const SOUNDS_KEY = 'alert_sounds';

// Default values returned when no row exists in OrgSetting.
export const SETTING_DEFAULTS: Record<string, string> = {
  rtsp_fps:            '8',
  rtsp_max_transcodes: '4',
};

export const settingsRouter = router({
  get: tenantProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.orgSetting.findMany();
    const map: Record<string, string> = { ...SETTING_DEFAULTS };
    for (const row of rows) map[row.key] = row.value;
    return map;
  }),

  set: adminProcedure
    .input(z.object({
      rtsp_fps: z.number().int().min(1).max(30),
      rtsp_max_transcodes: z.number().int().min(1).max(RTSP_HARD_CAP),
    }))
    .mutation(async ({ ctx, input }) => {
      const pairs = [
        { key: 'rtsp_fps',            value: String(input.rtsp_fps) },
        { key: 'rtsp_max_transcodes', value: String(input.rtsp_max_transcodes) },
      ];
      await Promise.all(
        pairs.map((p) =>
          ctx.db.orgSetting.upsert({
            where:  { key: p.key },
            update: { value: p.value },
            create: { key: p.key, value: p.value },
          })
        )
      );
      return { ok: true };
    }),

  listSounds: tenantProcedure.query(async ({ ctx }) => {
    const row = await ctx.db.orgSetting.findUnique({ where: { key: SOUNDS_KEY } });
    return parseSounds(row?.value);
  }),

  getSoundUploadUrl: adminProcedure
    .input(z.object({ mimeType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return getMinioSoundUploadUrl(ctx.orgSlug, input.mimeType);
    }),

  confirmSound: adminProcedure
    .input(z.object({ key: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!isSoundKey(input.key)) throw new Error('Invalid sound key');
      const url = getSoundPublicUrl(input.key);
      const row = await ctx.db.orgSetting.findUnique({ where: { key: SOUNDS_KEY } });
      const sounds = parseSounds(row?.value);
      const entry: SoundEntry = { id: randomUUID(), name: input.name, key: input.key, url };
      sounds.push(entry);
      await ctx.db.orgSetting.upsert({
        where: { key: SOUNDS_KEY },
        update: { value: JSON.stringify(sounds) },
        create: { key: SOUNDS_KEY, value: JSON.stringify(sounds) },
      });
      return entry;
    }),

  deleteSound: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.orgSetting.findUnique({ where: { key: SOUNDS_KEY } });
      const sounds = parseSounds(row?.value);
      const entry = sounds.find((s) => s.id === input.id);
      if (!entry) return { ok: true };
      const updated = sounds.filter((s) => s.id !== input.id);
      await ctx.db.orgSetting.upsert({
        where: { key: SOUNDS_KEY },
        update: { value: JSON.stringify(updated) },
        create: { key: SOUNDS_KEY, value: JSON.stringify(updated) },
      });
      // Delete from MinIO — best-effort, don't fail if missing
      try {
        await getMinio().removeObject(process.env.MINIO_BUCKET!, entry.key);
      } catch { /* ignore */ }
      return { ok: true };
    }),
});
