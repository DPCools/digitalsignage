# Email Notifications: Templates + Recipient Lists

**Date:** 2026-07-03
**Status:** Approved design, pending spec review

## Overview

Add configurable, fully-editable email templates for three events, and reusable
named recipient lists that can be assigned to alerts (per-alert, multiple) and to
the screen-offline event (globally, on the template).

Events:
1. **USER_INVITED** — sent to a newly invited user with their join link. (Net-new;
   no email is sent on invite today.)
2. **ALERT_TRIGGERED** — sent to the recipient lists assigned to an alert when it
   is triggered. (Net-new; alerts send no email today.)
3. **SCREEN_OFFLINE** — sent when a screen goes offline. Replaces the current
   hardcoded one-line email in `cron.ts`; adds location + offline time.

Builds on existing infra: `lib/email.ts` (`sendEmail`, `buildSmtpConfig`,
HTML→text, SMTP error translation) and the SMTP settings already in
`settings.getEmail/setEmail/testEmail`.

## Data model (one tenant migration)

```prisma
model RecipientList {
  id        String   @id @default(cuid())
  name      String
  emails    String[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model EmailTemplate {
  id               String   @id @default(cuid())
  event            String   @unique   // USER_INVITED | ALERT_TRIGGERED | SCREEN_OFFLINE
  enabled          Boolean  @default(true)
  subject          String
  bodyHtml         String
  recipientListIds String[]           // used by SCREEN_OFFLINE (global recipients)
  updatedAt        DateTime @updatedAt
}

// EmergencyAlert: add
recipientListIds String[]             // lists emailed when this alert triggers
```

Templates are seeded with sensible defaults on first read (`emailTemplates.getAll`
upserts any missing event rows).

## Placeholders (per event)

Rendered by `renderTemplate(html, vars)` — `{{key}}` substitution, each value
HTML-escaped. Unknown placeholders are left as-is.

- **USER_INVITED:** `{{inviteLink}}`, `{{orgName}}`, `{{inviterName}}`, `{{email}}`, `{{role}}`, `{{expiresAt}}`
- **ALERT_TRIGGERED:** `{{alertTitle}}`, `{{alertMessage}}`, `{{severity}}`, `{{triggeredAt}}`, `{{screens}}`
- **SCREEN_OFFLINE:** `{{screenName}}`, `{{location}}`, `{{offlineAt}}`, `{{lastHeartbeat}}`

`{{location}}` resolves to the screen's group (`group.location` or `group.name`,
falling back to "—" when the screen is ungrouped).
`{{inviteLink}}` = `${AUTH_URL}/invite/${token}` (server-side env).

## Backend

New shared helper `lib/email-templates.ts`:
- `renderTemplate(html: string, vars: Record<string,string>): string`
- `sendEventEmail(db, event, vars, recipients: string[])` — loads the template,
  returns early if disabled / no SMTP / no recipients, renders subject+body, sends.
  Best-effort: never throws to the caller.
- `resolveListEmails(db, listIds: string[]): string[]` — deduped union of emails.

New router `recipientLists` (adminProcedure): `list`, `create`, `update`, `delete`.

New router `emailTemplates` (adminProcedure): `getAll` (seed-on-read), `update`
(subject/body/enabled/recipientListIds), `sendTest` (renders provided draft
content against sample vars and sends to a given address).

Wiring:
- **users.invite** — after creating the invite, `sendEventEmail(USER_INVITED, …)`
  to the invitee. Invite still succeeds if email fails (best-effort; surface a
  soft warning in the result).
- **alerts.create** and **/api/v1/alerts/trigger** (+ `alertTemplates.trigger`) —
  add `recipientListIds` to the alert; after create, resolve list emails and
  `void sendEventEmail(ALERT_TRIGGERED, …)` fire-and-forget (mirrors
  `pushAlertAudio`).
- **cron.ts** screen-offline — replace hardcoded HTML with
  `sendEventEmail(SCREEN_OFFLINE, …)`; recipients = union of the lists assigned to
  the SCREEN_OFFLINE template. Include location + offline time.

## UI — Settings page becomes tabbed

Two tabs:
- **SMTP & Alerts** — SMTP Connection (existing EmailSection, minus the retired
  single recipients box), Recipient Lists (new), Email Templates (new), Alert
  Sounds (existing), and the hidden Danger Zone / reset-history easter egg.
- **Transcoding** — RTSP settings (existing).

New sections:
- **Recipient Lists:** CRUD named lists (name + email addresses).
- **Email Templates:** one card per event — enable toggle, subject input, HTML
  body editor, clickable placeholder chips (insert at cursor), Send-test button;
  the SCREEN_OFFLINE card also has a recipient-list multi-select.

Alert-create form (alerts page): add a **recipient-list multi-select** so each
alert can target multiple lists.

## Decisions

- **Retire** the single `smtp_notification_emails` box. Migrate its current value
  into a "Default notifications" `RecipientList` and assign it to the
  SCREEN_OFFLINE template so existing offline emails keep working.
- Emails are **best-effort** — a failed send never blocks the invite / alert /
  offline-mark.
- **Test-send uses unsaved editor content** so drafts can be previewed.
- Alerts reference lists by id array (`recipientListIds`); deleting a list does
  not rewrite alert history (stale ids are simply skipped at send time).

## Out of scope

- Per-user notification preferences / unsubscribe.
- Rich (WYSIWYG) editor — body is raw HTML with placeholder chips.
- Scheduling / digesting of emails.
