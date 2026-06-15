import { NextRequest, NextResponse } from 'next/server';
import { getTenantClient } from '@signflow/db';
import { getMinio } from '@/lib/minio';
import type { SnapshotRequest } from '@signflow/types';

export async function POST(req: NextRequest) {
  const body: SnapshotRequest = await req.json();
  if (!body.screenId || !body.orgSlug || !body.imageBase64) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const buffer = Buffer.from(body.imageBase64, 'base64');
  const key = `snapshots/${body.orgSlug}/${body.screenId}.png`;
  const minio = getMinio();
  await minio.putObject(process.env.MINIO_BUCKET!, key, buffer, { 'Content-Type': 'image/png' });

  const url = `${process.env.MINIO_PUBLIC_URL}/${process.env.MINIO_BUCKET}/${key}`;
  const db = getTenantClient(body.orgSlug);
  await db.screen.update({ where: { id: body.screenId }, data: { lastSnapshot: url } });

  return NextResponse.json({ ok: true, url });
}
