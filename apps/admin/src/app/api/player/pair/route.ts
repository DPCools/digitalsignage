import { NextRequest, NextResponse } from 'next/server';
import { publicClient, getTenantClient } from '@signflow/db';
import { nanoid } from 'nanoid';
import { generateOpaqueToken } from '@/lib/player-auth';
import { isPairingCodeExpired } from '@/lib/pairing';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400, headers: CORS });

  const pairing = await publicClient.pairingCode.findUnique({ where: { code } });

  if (!pairing?.screenId || !pairing.orgSlug) {
    // Not claimed yet — distinguish "still waiting" from "expired/invalid" so
    // the player's poll loop knows when to regenerate a fresh code instead of
    // polling a dead code forever.
    if (!pairing || isPairingCodeExpired(pairing)) {
      return NextResponse.json({ error: 'Pairing code expired' }, { status: 410, headers: CORS });
    }
    return NextResponse.json({ pending: true }, { status: 202, headers: CORS });
  }

  // Issue an opaque token and persist it as the screen's token of record —
  // verification is by DB lookup, so this survives any future
  // PLAYER_TOKEN_SECRET rotation.
  const token = generateOpaqueToken();
  const db = getTenantClient(pairing.orgSlug);
  await db.screen.update({ where: { id: pairing.screenId }, data: { authToken: token } });

  return NextResponse.json({
    screenId: pairing.screenId,
    orgSlug: pairing.orgSlug,
    token,
  }, { headers: CORS });
}

export async function POST() {
  const code = nanoid(6).toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await publicClient.pairingCode.create({ data: { code, expiresAt } });
  return NextResponse.json({ code }, { status: 201, headers: CORS });
}
