import nodemailer from 'nodemailer';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

export function buildSmtpConfig(settings: Record<string, string>): SmtpConfig | null {
  const host = settings['smtp_host']?.trim();
  const user = settings['smtp_user']?.trim();
  const password = settings['smtp_password']?.trim();
  if (!host || !user || !password) return null;
  return {
    host,
    port: parseInt(settings['smtp_port'] ?? '587', 10),
    secure: settings['smtp_secure'] === 'true',
    user,
    password,
    fromEmail: settings['smtp_from_email']?.trim() || user,
    fromName: settings['smtp_from_name']?.trim() || 'SignFlow',
  };
}

// Translates common low-level SMTP/TLS errors into messages an admin can
// actually act on, instead of a raw OpenSSL error code.
function translateSmtpError(err: unknown, config: SmtpConfig): string {
  const message = err instanceof Error ? err.message : String(err);

  if (message.includes('wrong version number')) {
    return config.secure
      ? `SSL isn't needed on port ${config.port} — this looks like a STARTTLS port. Uncheck "Secure" and try again (or switch to port 465 if your server requires SSL immediately).`
      : `Port ${config.port} expects an immediate SSL connection — check "Secure" and try again (or switch to port 587 for STARTTLS).`;
  }
  if (message.includes('ECONNREFUSED')) {
    return `Connection refused by ${config.host}:${config.port} — check the host and port are correct and not blocked by a firewall.`;
  }
  if (message.includes('ENOTFOUND') || message.includes('EAI_AGAIN')) {
    return `Couldn't resolve host "${config.host}" — check for typos in the SMTP host.`;
  }
  if (message.includes('ETIMEDOUT') || message.includes('ESOCKET')) {
    return `Connection to ${config.host}:${config.port} timed out — check the port and any firewall rules.`;
  }
  if (message.includes('Invalid login') || message.includes('535') || message.includes('EAUTH')) {
    return `Authentication failed — check the username and password.`;
  }
  if (message.toLowerCase().includes('certificate')) {
    return `TLS certificate error from ${config.host} — the server's certificate isn't trusted.`;
  }
  return message;
}

// Spam filters weigh HTML-only emails (no plain-text part) as a signal —
// derive a plain-text fallback automatically so every sendEmail caller gets
// a proper multipart message without having to write their own text version.
function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function sendEmail(
  config: SmtpConfig,
  to: string[],
  subject: string,
  html: string,
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
  });
  try {
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: to.join(', '),
      subject,
      html,
      text: htmlToText(html),
    });
  } catch (err) {
    throw new Error(translateSmtpError(err, config));
  }
}
