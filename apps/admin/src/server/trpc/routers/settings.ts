import { z } from 'zod';
import { router, tenantProcedure, adminProcedure } from '../init';
import { RTSP_HARD_CAP } from '@/lib/rtsp-semaphore';

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
});
