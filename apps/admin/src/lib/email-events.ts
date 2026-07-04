// Pure, dependency-free definitions for the email-notification system.
// Safe to import from client components (no nodemailer / server-only imports) so
// the Settings UI can render placeholder chips and seed defaults locally.

export type EmailEvent = 'USER_INVITED' | 'ALERT_TRIGGERED' | 'SCREEN_OFFLINE';

export interface EmailPlaceholder {
  key: string;
  label: string;
}

export interface EmailEventDef {
  event: EmailEvent;
  label: string;
  description: string;
  /** Whether recipient lists are assigned to the template itself (SCREEN_OFFLINE)
   *  vs. sourced elsewhere (per-alert / the invitee). Drives the settings UI. */
  hasListRecipients: boolean;
  placeholders: EmailPlaceholder[];
  defaultSubject: string;
  defaultBodyHtml: string;
}

export const EMAIL_EVENTS: EmailEventDef[] = [
  {
    event: 'USER_INVITED',
    label: 'New user invited',
    description: 'Sent to a person when they are invited, with their join link.',
    hasListRecipients: false,
    placeholders: [
      { key: 'inviteLink', label: 'Join link' },
      { key: 'orgName', label: 'Organisation' },
      { key: 'inviterName', label: 'Invited by' },
      { key: 'email', label: 'Their email' },
      { key: 'role', label: 'Role' },
      { key: 'expiresAt', label: 'Invite expires' },
    ],
    defaultSubject: "You've been invited to {{orgName}} on SignFlow",
    defaultBodyHtml: [
      '<p>Hi,</p>',
      '<p>{{inviterName}} has invited you to join <strong>{{orgName}}</strong> on SignFlow as {{role}}.</p>',
      '<p><a href="{{inviteLink}}">Accept your invitation</a></p>',
      '<p>This invitation expires on {{expiresAt}}.</p>',
    ].join('\n'),
  },
  {
    event: 'ALERT_TRIGGERED',
    label: 'Emergency alert triggered',
    description: 'Sent to the recipient lists attached to an alert when it fires.',
    hasListRecipients: false,
    placeholders: [
      { key: 'alertTitle', label: 'Title' },
      { key: 'alertMessage', label: 'Message' },
      { key: 'severity', label: 'Severity' },
      { key: 'triggeredAt', label: 'Triggered at' },
      { key: 'screens', label: 'Target screens' },
    ],
    defaultSubject: '[{{severity}}] {{alertTitle}}',
    defaultBodyHtml: [
      '<p>An emergency alert has been triggered.</p>',
      '<h2>{{alertTitle}}</h2>',
      '<p>{{alertMessage}}</p>',
      '<p><strong>Severity:</strong> {{severity}}<br>',
      '<strong>Triggered:</strong> {{triggeredAt}}<br>',
      '<strong>Screens:</strong> {{screens}}</p>',
    ].join('\n'),
  },
  {
    event: 'SCREEN_OFFLINE',
    label: 'Screen offline',
    description: 'Sent when a screen stops sending heartbeats.',
    hasListRecipients: true,
    placeholders: [
      { key: 'screenName', label: 'Screen name' },
      { key: 'location', label: 'Location' },
      { key: 'offlineAt', label: 'Went offline' },
      { key: 'lastHeartbeat', label: 'Last heartbeat' },
    ],
    defaultSubject: 'Screen offline: {{screenName}}',
    defaultBodyHtml: [
      '<p>The screen <strong>{{screenName}}</strong> has gone offline and is no longer sending heartbeats.</p>',
      '<p><strong>Location:</strong> {{location}}<br>',
      '<strong>Went offline:</strong> {{offlineAt}}<br>',
      '<strong>Last heartbeat:</strong> {{lastHeartbeat}}</p>',
    ].join('\n'),
  },
];

export const EMAIL_EVENT_MAP: Record<EmailEvent, EmailEventDef> = Object.fromEntries(
  EMAIL_EVENTS.map((e) => [e.event, e])
) as Record<EmailEvent, EmailEventDef>;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Substitutes {{key}} (optional surrounding whitespace) with the matching value.
// Body content is HTML-escaped to prevent injection; subjects render raw text.
// Unknown placeholders are left untouched so a typo is visible rather than blank.
export function renderTemplate(
  template: string,
  vars: Record<string, string>,
  { escape = true }: { escape?: boolean } = {}
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    if (!(key in vars)) return match;
    const value = vars[key] ?? '';
    return escape ? escapeHtml(value) : value;
  });
}
