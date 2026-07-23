import { z } from 'zod';
import { router, adminProcedure } from '../init';
import { TRPCError } from '@trpc/server';
import { EMAIL_EVENTS, EMAIL_EVENT_MAP, renderTemplate } from '@/lib/email-events';
import { loadSmtpConfig } from '@/lib/email-templates';
import { sendEmail } from '@/lib/email';

const EVENT_ENUM = z.enum(['USER_INVITED', 'ALERT_TRIGGERED', 'SCREEN_OFFLINE']);

export const emailTemplatesRouter = router({
  // Seed-on-read: create a row for any event that doesn't have one yet, using the
  // built-in defaults, then return all templates.
  getAll: adminProcedure.query(async ({ ctx }) => {
    const existing = await ctx.db.emailTemplate.findMany();
    const have = new Set(existing.map((e) => e.event));
    const missing = EMAIL_EVENTS.filter((e) => !have.has(e.event));
    if (missing.length > 0) {
      await ctx.db.emailTemplate.createMany({
        data: missing.map((e) => ({
          event: e.event,
          subject: e.defaultSubject,
          bodyHtml: e.defaultBodyHtml,
        })),
        skipDuplicates: true,
      });
    }

    // One-time migration: if this org has no recipient lists yet but had the
    // legacy single "notification emails" setting, import it into a list and
    // assign it to the screen-offline template so existing alerts keep flowing.
    if (await ctx.db.recipientList.count() === 0) {
      const legacy = await ctx.db.orgSetting.findUnique({ where: { key: 'smtp_notification_emails' } });
      const emails = (legacy?.value ?? '').split(',').map((e) => e.trim()).filter(Boolean);
      if (emails.length > 0) {
        const list = await ctx.db.recipientList.create({ data: { name: 'Default notifications', emails } });
        await ctx.db.emailTemplate.update({
          where: { event: 'SCREEN_OFFLINE' },
          data: { recipientListIds: [list.id] },
        });
      }
    }

    return ctx.db.emailTemplate.findMany();
  }),

  update: adminProcedure
    .input(z.object({
      event: EVENT_ENUM,
      enabled: z.boolean().optional(),
      subject: z.string().min(1).optional(),
      bodyHtml: z.string().min(1).optional(),
      recipientListIds: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { event, ...data } = input;
      const def = EMAIL_EVENT_MAP[event];
      return ctx.db.emailTemplate.upsert({
        where: { event },
        update: data,
        create: {
          event,
          subject: data.subject ?? def.defaultSubject,
          bodyHtml: data.bodyHtml ?? def.defaultBodyHtml,
          enabled: data.enabled ?? true,
          recipientListIds: data.recipientListIds ?? [],
        },
      });
    }),

  // Renders the supplied (possibly unsaved) draft against sample placeholder
  // values and sends it to one address, so an admin can preview before saving.
  sendTest: adminProcedure
    .input(z.object({
      event: EVENT_ENUM,
      subject: z.string().min(1),
      bodyHtml: z.string().min(1),
      to: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      const config = loadSmtpConfig();
      if (!config) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'SMTP is not configured — set it up first.' });
      }
      const def = EMAIL_EVENT_MAP[input.event];
      const sampleVars = Object.fromEntries(def.placeholders.map((p) => [p.key, `[${p.label}]`]));
      const subject = renderTemplate(input.subject, sampleVars, { escape: false });
      const html = renderTemplate(input.bodyHtml, sampleVars, { escape: true });
      await sendEmail(config, [input.to], subject, html);
      return { ok: true };
    }),
});
