import { createHmac, timingSafeEqual } from 'crypto';

export function generatePlayerToken(screenId: string, orgSlug: string): string {
  return createHmac('sha256', process.env.PLAYER_TOKEN_SECRET!)
    .update(`${screenId}:${orgSlug}`)
    .digest('base64url');
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
