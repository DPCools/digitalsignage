import { NextRequest, NextResponse } from 'next/server';
import { getTenantClient } from '@signflow/db';
import type { ImpressionsRequest } from '@signflow/types';
import { verifyPlayerToken, isSafeOrgSlug, isSafeId } from '@/lib/player-auth';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const body: ImpressionsRequest = await req.json();
  if (!body.orgSlug || !body.impressions?.length) {
    return NextResponse.json({ ok: true });
  }
  const screenId = body.impressions[0]?.screenId;
  if (!screenId || !isSafeOrgSlug(body.orgSlug) || !isSafeId(screenId)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }
  if (!verifyPlayerToken(screenId, body.orgSlug, req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getTenantClient(body.orgSlug);

  // Filter out impressions whose content items have been deleted to avoid FK violations
  const contentItemIds = [...new Set(body.impressions.map((i) => i.contentItemId))];
  const existing = await db.contentItem.findMany({
    where: { id: { in: contentItemIds } },
    select: { id: true },
  });
  const validIds = new Set(existing.map((e) => e.id));
  const valid = body.impressions.filter((i) => validIds.has(i.contentItemId));

  if (valid.length) {
    await db.impression.createMany({
      data: valid.map((i) => ({
        contentItemId: i.contentItemId,
        screenId: i.screenId,
        playedAt: new Date(i.playedAt),
        durationMs: i.durationMs,
      })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({ ok: true });
}
