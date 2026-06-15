import { NextRequest, NextResponse } from 'next/server';
import { getTenantClient } from '@signflow/db';
import type { ImpressionsRequest } from '@signflow/types';

export async function POST(req: NextRequest) {
  const body: ImpressionsRequest = await req.json();
  if (!body.orgSlug || !body.impressions?.length) {
    return NextResponse.json({ ok: true });
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
