import type { TenantPrismaClient } from '@signflow/db';
import { buildSmtpConfig, sendEmail, type SmtpConfig } from './email';
import {
  EMAIL_EVENT_MAP,
  renderTemplate,
  type EmailEvent,
} from './email-events';

// Loads the org's SMTP config from OrgSetting rows. Returns null when SMTP is
// not configured, so callers can no-op silently.
export async function loadSmtpConfig(db: TenantPrismaClient): Promise<SmtpConfig | null> {
  const rows = await db.orgSetting.findMany({ where: { key: { startsWith: 'smtp_' } } });
  const m: Record<string, string> = {};
  for (const r of rows) m[r.key] = r.value;
  return buildSmtpConfig(m);
}

// Deduped union of every email address across the given recipient lists. Unknown
// or deleted list ids are simply skipped.
export async function resolveListEmails(
  db: TenantPrismaClient,
  listIds: string[] | null | undefined
): Promise<string[]> {
  if (!listIds || listIds.length === 0) return [];
  const lists = await db.recipientList.findMany({
    where: { id: { in: listIds } },
    select: { emails: true },
  });
  const all = lists.flatMap((l) => l.emails).map((e) => e.trim()).filter(Boolean);
  return [...new Set(all)];
}

interface TemplateContent {
  enabled: boolean;
  subject: string;
  bodyHtml: string;
}

// Returns the stored template for an event, falling back to the built-in default
// (enabled) when no row has been created yet. Does not persist — seeding happens
// on the settings screen via emailTemplates.getAll.
async function getTemplateContent(
  db: TenantPrismaClient,
  event: EmailEvent
): Promise<TemplateContent> {
  const row = await db.emailTemplate.findUnique({ where: { event } });
  if (row) return { enabled: row.enabled, subject: row.subject, bodyHtml: row.bodyHtml };
  const def = EMAIL_EVENT_MAP[event];
  return { enabled: true, subject: def.defaultSubject, bodyHtml: def.defaultBodyHtml };
}

// Renders and sends a templated event email. Best-effort: returns silently (never
// throws) when there are no recipients, the template is disabled, or SMTP is not
// configured, and logs — but does not surface — any send failure so the calling
// action (invite, alert, offline-mark) is never blocked by email.
export async function sendEventEmail(
  db: TenantPrismaClient,
  event: EmailEvent,
  vars: Record<string, string>,
  recipients: string[]
): Promise<void> {
  try {
    const to = [...new Set(recipients.map((r) => r.trim()).filter(Boolean))];
    if (to.length === 0) return;

    const tpl = await getTemplateContent(db, event);
    if (!tpl.enabled) return;

    const config = await loadSmtpConfig(db);
    if (!config) return;

    const subject = renderTemplate(tpl.subject, vars, { escape: false });
    const html = renderTemplate(tpl.bodyHtml, vars, { escape: true });
    await sendEmail(config, to, subject, html);
  } catch (err) {
    console.error(`[email] ${event} send failed:`, err);
  }
}
