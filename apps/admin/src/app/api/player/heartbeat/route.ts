import { NextRequest, NextResponse } from 'next/server';
import { getTenantClient } from '@signflow/db';
import type { HeartbeatRequest } from '@signflow/types';
import { verifyPlayerToken } from '@/lib/player-auth';

export async function POST(req: NextRequest) {
  const body: HeartbeatRequest = await req.json();
  if (!body.screenId || !body.orgSlug) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (!verifyPlayerToken(body.screenId, body.orgSlug, req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
