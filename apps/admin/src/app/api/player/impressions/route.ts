import { NextRequest, NextResponse } from 'next/server';
import { getTenantClient } from '@signflow/db';
import type { ImpressionsRequest } from '@signflow/types';
import { verifyPlayerToken } from '@/lib/player-auth';

export async function POST(req: NextRequest) {
  const body: ImpressionsRequest = await req.json();
  if (!body.orgSlug || !body.impressions?.length) {
    return NextResponse.json({ ok: true });
  }
  const screenId = body.impressions[0]?.screenId;
  if (!screenId || !verifyPlayerToken(screenId, body.orgSlug, req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getTenantClient(body.orgSlug);
  await db.impression.createMany({
    data: body.impressions.map((i) => ({
      contentItemId: i.contentItemId,
      screenId: i.screenId,
      playedAt: new Date(i.playedAt),
      durationMs: i.durationMs,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ ok: true });
}
