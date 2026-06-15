import { NextRequest, NextResponse } from 'next/server';
import type { PlayerErrorRequest } from '@signflow/types';
import pino from 'pino';

const logger = pino();

export async function POST(req: NextRequest) {
  const body: PlayerErrorRequest = await req.json();
  logger.error({ screenId: body.screenId, orgSlug: body.orgSlug, zone: body.zone }, body.message);
  return NextResponse.json({ ok: true });
}
