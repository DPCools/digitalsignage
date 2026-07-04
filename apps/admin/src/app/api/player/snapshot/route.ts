import { NextRequest, NextResponse } from 'next/server';
import { getTenantClient } from '@signflow/db';
import { getMinio, ensureBucketPolicy } from '@/lib/minio';
import type { SnapshotRequest } from '@signflow/types';
import { verifyAndSyncPlayerToken, isSafeOrgSlug, isSafeId } from '@/lib/player-auth';

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
  if (!isSafeOrgSlug(body.orgSlug) || !isSafeId(body.screenId)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }
  const db = getTenantClient(body.orgSlug);
  if (!(await verifyAndSyncPlayerToken(db, body.screenId, body.orgSlug, req.headers.get('authorization')))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ~2 MB base64 ≈ 1.5 MB decoded image
  if (body.imageBase64.length > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'Snapshot too large' }, { status: 413 });
  }

  await ensureBucketPolicy();

  const buffer = Buffer.from(body.imageBase64, 'base64');
  // Detect JPEG vs PNG from magic bytes so either format works
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const ext = isJpeg ? 'jpg' : 'png';
  const mime = isJpeg ? 'image/jpeg' : 'image/png';
  const key = `snapshots/${body.orgSlug}/${body.screenId}.${ext}`;
  const minio = getMinio();
  await minio.putObject(process.env.MINIO_BUCKET!, key, buffer, buffer.length, { 'Content-Type': mime });

  // ?v= version stamp ensures lastSnapshot changes on every upload so the admin
  // UI's proxy URL cache-key changes and the browser re-fetches the new image.
  const url = `${process.env.MINIO_PUBLIC_URL}/${process.env.MINIO_BUCKET}/${key}?v=${Date.now()}`;
  await db.screen.update({ where: { id: body.screenId }, data: { lastSnapshot: url } });

  return NextResponse.json({ ok: true, url });
}
