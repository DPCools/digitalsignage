import { NextRequest, NextResponse } from 'next/server';
import { getTenantClient } from '@signflow/db';
import type { HeartbeatRequest } from '@signflow/types';
import { verifyPlayerToken, isSafeOrgSlug, isSafeId } from '@/lib/player-auth';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const body: HeartbeatRequest = await req.json();
  if (!body.screenId || !body.orgSlug) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (!isSafeOrgSlug(body.orgSlug) || !isSafeId(body.screenId)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }
  if (!verifyPlayerToken(body.screenId, body.orgSlug, req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate-limit per authenticated principal (orgSlug:screenId) — not IP, which is spoofable via XFF
  const { success } = await rateLimit(`heartbeat:${body.orgSlug}:${body.screenId}`, 4, 60);
  if (!success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const db = getTenantClient(body.orgSlug);
  await db.screen.update({
    where: { id: body.screenId },
    data: {
      isOnline: true,
      lastHeartbeat: new Date(),
      currentPlaylistId: body.playlistId ?? undefined,
    },
  });

  await db.screenHeartbeat.create({
    data: {
      screenId: body.screenId,
      playlistId: body.playlistId,
      contentId: body.contentId,
    },
  });

  return NextResponse.json({ ok: true });
}
