import { NextRequest, NextResponse } from 'next/server';
import type { PlayerErrorRequest } from '@signflow/types';
import pino from 'pino';
import { verifyPlayerToken } from '@/lib/player-auth';

const logger = pino();

export async function POST(req: NextRequest) {
  const body: PlayerErrorRequest = await req.json();
  if (!body.screenId || !body.orgSlug) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (!verifyPlayerToken(body.screenId, body.orgSlug, req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  logger.error({ screenId: body.screenId, orgSlug: body.orgSlug, zone: body.zone }, body.message);
  return NextResponse.json({ ok: true });
}
