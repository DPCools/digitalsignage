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
      { key: 'membersName', label: 'Their name' },
      { key: 'email', label: 'Their email' },
      { key: 'role', label: 'Role' },
      { key: 'expiresAt', label: 'Invite expires' },
    ],
    defaultSubject: "You've been invited to {{orgName}} on SignFlow",
    defaultBodyHtml: `<!-- Hidden preview text (shows in inbox next to subject) -->
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#EEF1F6;">
  {{inviterName}} invited you to join {{orgName}} on Digital SignFlow — accept before {{expiresAt}}.
</div>

<!-- Full-width background wrapper -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF1F6;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <!-- 600px card -->
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background:#FFFFFF; border-radius:16px; overflow:hidden; box-shadow:0 6px 24px rgba(11,16,32,0.08);">

        <!-- Header: dark display panel with cyan glow -->
        <tr>
          <td bgcolor="#0B1020" style="background:#0B1020; background-image:linear-gradient(135deg,#0B1020 0%,#111A33 100%); padding:34px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="left" style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  <span style="display:inline-block; width:9px; height:9px; background:#22D3EE; border-radius:50%; margin-right:9px; vertical-align:middle; box-shadow:0 0 10px #22D3EE;"></span>
                  <span style="font-size:20px; font-weight:700; letter-spacing:-0.02em; color:#FFFFFF; vertical-align:middle;">Digital SignFlow</span>
                </td>
                <td align="right" style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:12px; letter-spacing:0.06em; text-transform:uppercase; color:#7DD3E8;">
                  Digital&nbsp;Signage
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Thin cyan accent line -->
        <tr><td style="height:4px; background:#06B6D4; line-height:4px; font-size:4px;">&nbsp;</td></tr>

        <!-- Body -->
        <tr>
          <td style="background:#FFFFFF; padding:40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

              <tr>
                <td style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  <p style="margin:0 0 6px; font-size:14px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#0891B2;">You've been invited</p>
                  <h1 style="margin:0 0 20px; font-size:30px; line-height:36px; font-weight:800; letter-spacing:-0.02em; color:#0B1020;">
                    Join {{orgName}} on&nbsp;Digital SignFlow
                  </h1>
                  <p style="margin:0 0 8px; font-size:16px; line-height:24px; color:#374151;">Hi {{membersName}},</p>
                  <p style="margin:0 0 28px; font-size:16px; line-height:24px; color:#374151;">
                    <strong style="color:#0B1020;">{{inviterName}}</strong> has invited you to collaborate. Here are the details:
                  </p>
                </td>
              </tr>

              <!-- Details card -->
              <tr>
                <td style="background:#F8FAFC; border:1px solid #E5E9F0; border-radius:12px; padding:20px 24px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding:6px 0; font-size:13px; color:#6B7280; width:120px;">Organisation</td>
                      <td style="padding:6px 0; font-size:15px; font-weight:600; color:#0B1020;">{{orgName}}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0; font-size:13px; color:#6B7280;">Role</td>
                      <td style="padding:6px 0;">
                        <span style="display:inline-block; background:#ECFEFF; color:#0E7490; font-size:13px; font-weight:700; padding:4px 12px; border-radius:999px;">{{role}}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0; font-size:13px; color:#6B7280;">Invited by</td>
                      <td style="padding:6px 0; font-size:15px; font-weight:600; color:#0B1020;">{{inviterName}}</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- CTA button (bulletproof for Outlook) -->
              <tr>
                <td align="center" style="padding:32px 0 8px;">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{inviteLink}}" style="height:52px;v-text-anchor:middle;width:260px;" arcsize="24%" strokecolor="#0891B2" fillcolor="#0891B2">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;font-size:16px;font-weight:bold;">Accept invitation</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a href="{{inviteLink}}" target="_blank"
                     style="display:inline-block; background:#0891B2; color:#FFFFFF; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:16px; font-weight:700; line-height:52px; text-align:center; text-decoration:none; padding:0 40px; border-radius:12px; letter-spacing:0.01em;">
                    Accept invitation
                  </a>
                  <!--<![endif]-->
                </td>
              </tr>

              <!-- Divider -->
              <tr><td style="padding:24px 0 0;"><div style="border-top:1px solid #E5E9F0; font-size:0; line-height:0;">&nbsp;</div></td></tr>

              <!-- Expiry note -->
              <tr>
                <td style="padding:20px 0 0; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  <p style="margin:0; font-size:14px; line-height:20px; color:#6B7280;">
                    &#9201;&nbsp; This invitation expires on <strong style="color:#0B1020;">{{expiresAt}}</strong>.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0B1020; padding:24px 40px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <p style="margin:0 0 4px; font-size:13px; line-height:20px; color:#9CA3AF;">
              Sent by <strong style="color:#FFFFFF;">Digital SignFlow</strong> · Digital signage, simplified.
            </p>
            <p style="margin:0; font-size:12px; line-height:18px; color:#6B7280;">
              If you weren't expecting this invitation, you can safely ignore this email.
            </p>
          </td>
        </tr>

      </table>
      <!-- /card -->

    </td>
  </tr>
</table>`,
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
    defaultBodyHtml: `<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#FEF2F2;">
  {{alertTitle}} — {{alertMessage}}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FEF2F2;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background:#FFFFFF; border-radius:16px; overflow:hidden; box-shadow:0 6px 24px rgba(11,16,32,0.08);">

        <!-- Header: dark panel with red glow -->
        <tr>
          <td bgcolor="#0B1020" style="background:#0B1020; background-image:linear-gradient(135deg,#0B1020 0%,#1F1013 100%); padding:34px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="left" style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  <span style="display:inline-block; width:9px; height:9px; background:#EF4444; border-radius:50%; margin-right:9px; vertical-align:middle; box-shadow:0 0 10px #EF4444;"></span>
                  <span style="font-size:20px; font-weight:700; letter-spacing:-0.02em; color:#FFFFFF; vertical-align:middle;">Digital SignFlow</span>
                </td>
                <td align="right" style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:12px; letter-spacing:0.06em; text-transform:uppercase; color:#FCA5A5;">
                  Emergency&nbsp;Alert
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr><td style="height:4px; background:#DC2626; line-height:4px; font-size:4px;">&nbsp;</td></tr>

        <tr>
          <td style="background:#FFFFFF; padding:40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

              <tr>
                <td style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  <p style="margin:0 0 6px; font-size:14px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#DC2626;">&#9888;&nbsp; Emergency alert triggered</p>
                  <h1 style="margin:0 0 20px; font-size:28px; line-height:34px; font-weight:800; letter-spacing:-0.02em; color:#0B1020;">
                    {{alertTitle}}
                  </h1>
                  <p style="margin:0 0 28px; font-size:16px; line-height:24px; color:#374151;">
                    {{alertMessage}}
                  </p>
                </td>
              </tr>

              <!-- Details card -->
              <tr>
                <td style="background:#FEF2F2; border:1px solid #FCA5A5; border-radius:12px; padding:20px 24px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding:6px 0; font-size:13px; color:#7F1D1D; width:120px;">Severity</td>
                      <td style="padding:6px 0;">
                        <span style="display:inline-block; background:#DC2626; color:#FFFFFF; font-size:13px; font-weight:700; padding:4px 12px; border-radius:999px;">{{severity}}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0; font-size:13px; color:#7F1D1D;">Triggered</td>
                      <td style="padding:6px 0; font-size:15px; font-weight:600; color:#0B1020;">{{triggeredAt}}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0; font-size:13px; color:#7F1D1D;">Screens</td>
                      <td style="padding:6px 0; font-size:15px; font-weight:600; color:#0B1020;">{{screens}}</td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0B1020; padding:24px 40px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <p style="margin:0 0 4px; font-size:13px; line-height:20px; color:#9CA3AF;">
              Sent by <strong style="color:#FFFFFF;">Digital SignFlow</strong> · Digital signage, simplified.
            </p>
            <p style="margin:0; font-size:12px; line-height:18px; color:#6B7280;">
              This is an automated emergency alert notification.
            </p>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>`,
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
    defaultBodyHtml: `<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#FFFBEB;">
  {{screenName}} went offline at {{offlineAt}}.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFBEB;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background:#FFFFFF; border-radius:16px; overflow:hidden; box-shadow:0 6px 24px rgba(11,16,32,0.08);">

        <!-- Header: dark panel with amber glow -->
        <tr>
          <td bgcolor="#0B1020" style="background:#0B1020; background-image:linear-gradient(135deg,#0B1020 0%,#1E1A0F 100%); padding:34px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="left" style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  <span style="display:inline-block; width:9px; height:9px; background:#9CA3AF; border-radius:50%; margin-right:9px; vertical-align:middle;"></span>
                  <span style="font-size:20px; font-weight:700; letter-spacing:-0.02em; color:#FFFFFF; vertical-align:middle;">Digital SignFlow</span>
                </td>
                <td align="right" style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:12px; letter-spacing:0.06em; text-transform:uppercase; color:#FCD34D;">
                  Screen&nbsp;Offline
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr><td style="height:4px; background:#D97706; line-height:4px; font-size:4px;">&nbsp;</td></tr>

        <tr>
          <td style="background:#FFFFFF; padding:40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

              <tr>
                <td style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  <p style="margin:0 0 6px; font-size:14px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#B45309;">&#128245;&nbsp; Screen went offline</p>
                  <h1 style="margin:0 0 20px; font-size:28px; line-height:34px; font-weight:800; letter-spacing:-0.02em; color:#0B1020;">
                    {{screenName}}
                  </h1>
                  <p style="margin:0 0 28px; font-size:16px; line-height:24px; color:#374151;">
                    This screen has stopped sending heartbeats and may need attention.
                  </p>
                </td>
              </tr>

              <!-- Details card -->
              <tr>
                <td style="background:#FFFBEB; border:1px solid #FDE68A; border-radius:12px; padding:20px 24px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding:6px 0; font-size:13px; color:#92400E; width:140px;">Location</td>
                      <td style="padding:6px 0; font-size:15px; font-weight:600; color:#0B1020;">{{location}}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0; font-size:13px; color:#92400E;">Went offline</td>
                      <td style="padding:6px 0; font-size:15px; font-weight:600; color:#0B1020;">{{offlineAt}}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0; font-size:13px; color:#92400E;">Last heartbeat</td>
                      <td style="padding:6px 0; font-size:15px; font-weight:600; color:#0B1020;">{{lastHeartbeat}}</td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0B1020; padding:24px 40px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <p style="margin:0 0 4px; font-size:13px; line-height:20px; color:#9CA3AF;">
              Sent by <strong style="color:#FFFFFF;">Digital SignFlow</strong> · Digital signage, simplified.
            </p>
            <p style="margin:0; font-size:12px; line-height:18px; color:#6B7280;">
              This is an automated screen health notification.
            </p>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>`,
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
