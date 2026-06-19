import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getTenantClient } from '@signflow/db';
import { isSafeOrgSlug } from '@/lib/player-auth';
import { rateLimit } from '@/lib/rate-limit';
import { emitToOrg, emitToScreen } from '@/server/socket';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Referrer-Policy': 'no-referrer',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const orgSlug = searchParams.get('orgSlug') ?? '';

  if (!orgSlug) {
    return NextResponse.json({ error: 'Missing orgSlug' }, { status: 400, headers: CORS });
  }

  if (!isSafeOrgSlug(orgSlug)) {
    return NextResponse.json({ error: 'Invalid orgSlug' }, { status: 400, headers: CORS });
  }

  // Extract API key: Authorization header first, then query param
  const authHeader = req.headers.get('authorization');
  let rawKey: string | null = null;
  if (authHeader?.startsWith('Bearer ')) {
    rawKey = authHeader.slice(7).trim();
  }
  if (!rawKey) {
    rawKey = searchParams.get('apiKey');
  }
  if (!rawKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401, headers: CORS });
  }

  const db = getTenantClient(orgSlug);

  // Authenticate first — rate limit is keyed on the verified key id so unauthenticated
  // requests cannot exhaust a legitimate caller's quota.
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const apiKey = await db.apiKey.findFirst({
    where: {
      keyHash,
      revokedAt: null,
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
    },
  });
  if (!apiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
  }

  const { success } = await rateLimit(`v1:alerts:clear:${apiKey.id}`, 10, 60);
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: CORS });
  }

  // Find all active alerts (before deactivating) so we know which screens to notify
  const activeAlerts = await db.emergencyAlert.findMany({ where: { isActive: true } });

  // Deactivate all active alerts first; only emit socket events if the write succeeds
  await db.emergencyAlert.updateMany({ where: { isActive: true }, data: { isActive: false } });

  for (const alert of activeAlerts) {
    if (alert.screenIds.length === 0) {
      emitToOrg(orgSlug, 'alert:clear');
    } else {
      alert.screenIds.forEach((id) => emitToScreen(orgSlug, id, 'alert:clear'));
    }
  }

  // Update lastUsedAt
  await db.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });

  return NextResponse.json({ ok: true }, { headers: CORS });
}
