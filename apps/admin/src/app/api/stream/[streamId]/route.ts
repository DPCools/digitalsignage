import { NextRequest, NextResponse } from 'next/server';
import { getTenantClient } from '@signflow/db';
import { verifyPlayerToken, isSafeOrgSlug, isSafeId } from '@/lib/player-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ streamId: string }> }
) {
  const { streamId } = await params;

  // Parse streamId: "{contentItemId}-{streamIndex}"
  const lastDash = streamId.lastIndexOf('-');
  if (lastDash === -1) {
    return NextResponse.json({ error: 'Invalid streamId format' }, { status: 400 });
  }
  const contentItemId = streamId.slice(0, lastDash);
  const streamIndexStr = streamId.slice(lastDash + 1);
  const streamIndex = parseInt(streamIndexStr, 10);

  if (!contentItemId || !/^\d+$/.test(streamIndexStr) || isNaN(streamIndex) || streamIndex < 0 || streamIndex > 3) {
    return NextResponse.json({ error: 'Invalid streamId format' }, { status: 400 });
  }

  const orgSlug = req.nextUrl.searchParams.get('orgSlug');
  const screenId = req.nextUrl.searchParams.get('screenId');

  if (!orgSlug || !screenId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  if (!isSafeOrgSlug(orgSlug) || !isSafeId(screenId) || !isSafeId(contentItemId)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }

  // Accept token via Authorization header OR ?token= query param.
  // The latter is needed because <img src> cannot set custom headers.
  const tokenParam = req.nextUrl.searchParams.get('token');
  const authHeader = req.headers.get('authorization') ?? (tokenParam ? `Bearer ${tokenParam}` : null);
  if (!verifyPlayerToken(screenId, orgSlug, authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getTenantClient(orgSlug);

  const item = await db.contentItem.findUnique({
    where: { id: contentItemId },
  });

  if (!item || item.type !== 'CCTV_GRID') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const meta = item.metadata as { streams?: Array<{ url: string; label?: string }> } | null;
  const streams = meta?.streams;

  if (!streams || streamIndex >= streams.length) {
    return NextResponse.json({ error: 'Stream index out of range' }, { status: 404 });
  }

  const rawUrl = streams[streamIndex].url;
  if (!rawUrl) {
    return NextResponse.json({ error: 'Stream URL not configured' }, { status: 404 });
  }

  // Extract embedded credentials and build clean URL
  let cleanUrl: string;
  let credentials: string | null = null;

  try {
    const u = new URL(rawUrl);
    if (u.username && u.password) {
      credentials = Buffer.from(`${u.username}:${u.password}`).toString('base64');
    }
    u.username = '';
    u.password = '';
    cleanUrl = u.toString();
  } catch {
    return NextResponse.json({ error: 'Invalid stream URL' }, { status: 502 });
  }

  // Fetch MJPEG stream from camera
  const fetchHeaders: HeadersInit = {};
  if (credentials) {
    fetchHeaders['Authorization'] = `Basic ${credentials}`;
  }

  let cameraResponse: Response;
  try {
    cameraResponse = await fetch(cleanUrl, {
      headers: fetchHeaders,
      // @ts-expect-error — Node fetch supports this signal-less duplex mode
      duplex: 'half',
    });
  } catch {
    return NextResponse.json({ error: 'Camera unreachable' }, { status: 502 });
  }

  if (!cameraResponse.ok) {
    return NextResponse.json({ error: 'Camera unreachable' }, { status: 502 });
  }

  return new NextResponse(cameraResponse.body, {
    status: 200,
    headers: {
      'Content-Type':
        cameraResponse.headers.get('content-type') ?? 'multipart/x-mixed-replace',
      'Cache-Control': 'no-store',
    },
  });
}
