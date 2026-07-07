import { z } from 'zod';
import { router, tenantProcedure, adminProcedure } from '../init';
import { RTSP_HARD_CAP } from '@/lib/rtsp-semaphore';
import { buildSmtpConfig, sendEmail } from '@/lib/email';

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

  getEmail: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.orgSetting.findMany({
      where: { key: { startsWith: 'smtp_' } },
    });
    const m: Record<string, string> = {};
    for (const r of rows) m[r.key] = r.value;
    return {
      host:               m['smtp_host']               ?? '',
      port:               m['smtp_port']               ?? '587',
      secure:             m['smtp_secure']             ?? 'false',
      user:               m['smtp_user']               ?? '',
      passwordSet:        Boolean(m['smtp_password']),
      fromEmail:          m['smtp_from_email']         ?? '',
      fromName:           m['smtp_from_name']          ?? 'SignFlow',
      notificationEmails: m['smtp_notification_emails'] ?? '',
    };
  }),

  setEmail: adminProcedure
    .input(z.object({
      host:               z.string(),
      port:               z.string(),
      secure:             z.string(),
      user:               z.string(),
      password:           z.string(),   // empty = keep existing
      fromEmail:          z.string(),
      fromName:           z.string(),
      // Retired from the UI (replaced by recipient lists); still accepted for
      // back-compat so a stale caller doesn't fail.
      notificationEmails: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const pairs = [
        { key: 'smtp_host',                value: input.host },
        { key: 'smtp_port',                value: input.port },
        { key: 'smtp_secure',              value: input.secure },
        { key: 'smtp_user',                value: input.user },
        { key: 'smtp_from_email',          value: input.fromEmail },
        { key: 'smtp_from_name',           value: input.fromName },
      ];
      if (input.notificationEmails !== undefined) {
        pairs.push({ key: 'smtp_notification_emails', value: input.notificationEmails });
      }
      if (input.password) pairs.push({ key: 'smtp_password', value: input.password });
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

  testEmail: adminProcedure
    .input(z.object({
      host:      z.string().min(1),
      port:      z.string(),
      secure:    z.string(),
      user:      z.string().min(1),
      password:  z.string(),   // may be empty — fall back to stored password
      fromEmail: z.string(),
      fromName:  z.string(),
      to:        z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      // If password not supplied, load stored password from DB
      let resolvedPassword = input.password;
      if (!resolvedPassword) {
        const stored = await ctx.db.orgSetting.findUnique({ where: { key: 'smtp_password' } });
        resolvedPassword = stored?.value ?? '';
      }
      const config = buildSmtpConfig({
        smtp_host:       input.host,
        smtp_port:       input.port,
        smtp_secure:     input.secure,
        smtp_user:       input.user,
        smtp_password:   resolvedPassword,
        smtp_from_email: input.fromEmail,
        smtp_from_name:  input.fromName,
      });
      if (!config) throw new Error('Missing SMTP credentials');
      await sendEmail(config, [input.to], 'SignFlow — test email', [
        '<p>This is a test email from <strong>SignFlow</strong>.</p>',
        '<p>If you received this, your email notification settings are working correctly.</p>',
      ].join(''));
      return { ok: true };
    }),
});
