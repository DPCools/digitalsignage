import { NextRequest, NextResponse } from 'next/server';
import { publicClient } from '@signflow/db';
import { nanoid } from 'nanoid';
import { generatePlayerToken } from '@/lib/player-auth';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

  const pairing = await publicClient.pairingCode.findUnique({ where: { code } });
  if (!pairing?.screenId || !pairing.orgSlug) {
    return NextResponse.json({ pending: true }, { status: 202 });
  }

  return NextResponse.json({
    screenId: pairing.screenId,
    orgSlug: pairing.orgSlug,
    token: generatePlayerToken(pairing.screenId, pairing.orgSlug),
  });
}

export async function POST() {
  const code = nanoid(6).toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await publicClient.pairingCode.create({ data: { code, expiresAt } });
  return NextResponse.json({ code }, { status: 201 });
}
