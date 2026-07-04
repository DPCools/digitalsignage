import { NextRequest, NextResponse } from 'next/server';
import { getTenantClient } from '@signflow/db';
import { verifyAndSyncPlayerToken, isSafeOrgSlug, isSafeId } from '@/lib/player-auth';
import { getRedis } from '@/lib/redis';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const screenId = req.nextUrl.searchParams.get('screenId');
  const orgSlug  = req.nextUrl.searchParams.get('orgSlug');

  if (!screenId || !orgSlug || !isSafeOrgSlug(orgSlug) || !isSafeId(screenId)) {
    return NextResponse.json({ pending: false }, { headers: CORS });
  }
  const db = getTenantClient(orgSlug);
  if (!(await verifyAndSyncPlayerToken(db, screenId, orgSlug, req.headers.get('authorization')))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
  }

  // Atomically consume the flag set by sendCommand('screenshot').
  // Returns '1' if a snapshot was requested, null if not.
  const result = await getRedis().getdel(`snap:${orgSlug}:${screenId}`);
  return NextResponse.json({ pending: result === '1' }, { headers: CORS });
}
