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

  // Rate limit before hitting the DB
  const { success } = await rateLimit(`v1:alerts:clear:${orgSlug}`, 10, 60);
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: CORS });
  }

  const db = getTenantClient(orgSlug);

  // Validate API key
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

  // Find all active alerts and emit clear events to their screens
  const activeAlerts = await db.emergencyAlert.findMany({ where: { isActive: true } });
  for (const alert of activeAlerts) {
    if (alert.screenIds.length === 0) {
      emitToOrg(orgSlug, 'alert:clear');
    } else {
      alert.screenIds.forEach((id) => emitToScreen(orgSlug, id, 'alert:clear'));
    }
  }

  // Deactivate all active alerts
  await db.emergencyAlert.updateMany({ where: { isActive: true }, data: { isActive: false } });

  // Update lastUsedAt
  await db.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });

  return NextResponse.json({ ok: true }, { headers: CORS });
}
