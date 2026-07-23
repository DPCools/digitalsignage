import type { TenantPrismaClient } from '@signflow/db';
import { buildSmtpConfig, sendEmail, type SmtpConfig } from './email';
import {
  EMAIL_EVENT_MAP,
  renderTemplate,
  type EmailEvent,
} from './email-events';

// Loads SMTP config from environment variables — one hardcoded server for the
// whole deployment, no longer per-org/DB-configurable via the settings UI.
// Returns null when SMTP is not configured, so callers can no-op silently.
export function loadSmtpConfig(): SmtpConfig | null {
  return buildSmtpConfig({
    smtp_host:       process.env.SMTP_HOST ?? '',
    smtp_port:       process.env.SMTP_PORT ?? '587',
    smtp_secure:     process.env.SMTP_SECURE ?? 'false',
    smtp_user:       process.env.SMTP_USER ?? '',
    smtp_password:   process.env.SMTP_PASSWORD ?? '',
    smtp_from_email: process.env.SMTP_FROM_EMAIL ?? '',
    smtp_from_name:  process.env.SMTP_FROM_NAME ?? 'SignFlow',
  });
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

    const config = loadSmtpConfig();
    if (!config) return;

    const subject = renderTemplate(tpl.subject, vars, { escape: false });
    const html = renderTemplate(tpl.bodyHtml, vars, { escape: true });
    await sendEmail(config, to, subject, html);
  } catch (err) {
    console.error(`[email] ${event} send failed:`, err);
  }
}
