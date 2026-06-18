import { NextRequest, NextResponse } from 'next/server';
import { getTenantClient } from '@signflow/db';
import { getMinio } from '@/lib/minio';
import type { SnapshotRequest } from '@signflow/types';
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
  const body: SnapshotRequest = await req.json();
  if (!body.screenId || !body.orgSlug || !body.imageBase64) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (!verifyPlayerToken(body.screenId, body.orgSlug, req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isSafeOrgSlug(body.orgSlug) || !isSafeId(body.screenId)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }
  // ~2 MB base64 ≈ 1.5 MB decoded image
  if (body.imageBase64.length > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'Snapshot too large' }, { status: 413 });
  }

  const buffer = Buffer.from(body.imageBase64, 'base64');
  const key = `snapshots/${body.orgSlug}/${body.screenId}.png`;
  const minio = getMinio();
  await minio.putObject(process.env.MINIO_BUCKET!, key, buffer, buffer.length, { 'Content-Type': 'image/png' });

  const url = `${process.env.MINIO_PUBLIC_URL}/${process.env.MINIO_BUCKET}/${key}`;
  const db = getTenantClient(body.orgSlug);
  await db.screen.update({ where: { id: body.screenId }, data: { lastSnapshot: url } });

  return NextResponse.json({ ok: true, url });
}
