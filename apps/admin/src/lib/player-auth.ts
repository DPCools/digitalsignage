import { createHmac, timingSafeEqual } from 'crypto';

export function generatePlayerToken(screenId: string, orgSlug: string): string {
  return createHmac('sha256', process.env.PLAYER_TOKEN_SECRET!)
    .update(`${screenId}:${orgSlug}`)
    .digest('base64url');
}

const STREAM_WINDOW_MS = 10 * 60 * 1000; // 10-minute windows

function streamTokenForWindow(screenId: string, orgSlug: string, window: number): string {
  return createHmac('sha256', process.env.PLAYER_TOKEN_SECRET!)
    .update(`stream:${screenId}:${orgSlug}:${window}`)
    .digest('base64url');
}

// Returns a token valid for the current 10-minute window.
// Include this in player config responses so <img src> URLs don't carry the long-lived bearer token.
export function generateStreamToken(screenId: string, orgSlug: string): string {
  return streamTokenForWindow(screenId, orgSlug, Math.floor(Date.now() / STREAM_WINDOW_MS));
}

// Accepts tokens from the current window and the previous window (10–20 min validity).
export function verifyStreamToken(
  screenId: string,
  orgSlug: string,
  token: string | null | undefined
): boolean {
  if (!token) return false;
  const now = Math.floor(Date.now() / STREAM_WINDOW_MS);
  for (const w of [now, now - 1]) {
    const expected = streamTokenForWindow(screenId, orgSlug, w);
    try {
      const a = Buffer.from(token);
      const b = Buffer.from(expected);
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    } catch { /* ignore */ }
  }
  return false;
}

export function verifyPlayerToken(
  screenId: string,
  orgSlug: string,
  authHeader: string | null | undefined
): boolean {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const expected = generatePlayerToken(screenId, orgSlug);
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export function isSafeOrgSlug(s: string): boolean {
  return SAFE_SLUG_RE.test(s) && !s.includes('..');
}

export function isSafeId(s: string): boolean {
  return SAFE_ID_RE.test(s) && !s.includes('..');
}
