import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { getTenantClient } from '@signflow/db';
import { getMinio, snapshotUrlToKey } from '@/lib/minio';

// Never let Next.js cache this route — snapshots update frequently.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const screenId = req.nextUrl.searchParams.get('screenId');
  if (!screenId) return NextResponse.json({ error: 'Missing screenId' }, { status: 400 });

  // Verify the screen belongs to this tenant — prevents cross-tenant IDOR
  const db = getTenantClient(session.user.orgSlug);
  const screen = await db.screen.findUnique({
    where: { id: screenId },
    select: { lastSnapshot: true },
  });

  if (!screen?.lastSnapshot) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Key derived from DB value — client never controls what is fetched
  const key = snapshotUrlToKey(screen.lastSnapshot);
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    // Short-lived presigned URL (5 min). The ?v= timestamp in lastSnapshot ensures
    // each upload produces a unique MinIO URL, so the browser always follows the
    // redirect to a URL it hasn't seen before and fetches fresh bytes.
    const rawUrl = await getMinio().presignedGetObject(
      process.env.MINIO_BUCKET!,
      key,
      5 * 60,
    );

    // Replace internal MinIO hostname with the configured public URL
    const internalBase = `http${process.env.MINIO_USE_SSL === 'true' ? 's' : ''}://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT ?? '9000'}`;
    const presignedUrl = rawUrl.replace(internalBase, process.env.MINIO_PUBLIC_URL!);

    return NextResponse.redirect(presignedUrl, {
      status: 302,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
