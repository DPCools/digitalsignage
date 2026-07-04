import { NextRequest, NextResponse } from 'next/server';
import { getTenantClient } from '@signflow/db';
import type { PlayerErrorRequest } from '@signflow/types';
import pino from 'pino';
import { verifyAndSyncPlayerToken, isSafeOrgSlug, isSafeId } from '@/lib/player-auth';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const logger = pino();

export async function POST(req: NextRequest) {
  const body: PlayerErrorRequest = await req.json();
  if (!body.screenId || !body.orgSlug) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (!isSafeOrgSlug(body.orgSlug) || !isSafeId(body.screenId)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }
  const db = getTenantClient(body.orgSlug);
  if (!(await verifyAndSyncPlayerToken(db, body.screenId, body.orgSlug, req.headers.get('authorization')))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  logger.error({ screenId: body.screenId, orgSlug: body.orgSlug, zone: body.zone }, body.message);
  return NextResponse.json({ ok: true });
}
