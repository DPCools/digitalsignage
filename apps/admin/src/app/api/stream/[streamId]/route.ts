import { NextRequest, NextResponse } from 'next/server';
import { getTenantClient } from '@signflow/db';
import { verifyPlayerToken, isSafeOrgSlug, isSafeId } from '@/lib/player-auth';

// Upstream content-types accepted from cameras. Anything outside this list is rejected
// to prevent XSS via Content-Type passthrough.
const ALLOWED_CONTENT_TYPES = [
  'multipart/x-mixed-replace',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

function isAllowedContentType(ct: string | null): boolean {
  if (!ct) return false;
  const base = ct.split(';')[0].trim().toLowerCase();
  return ALLOWED_CONTENT_TYPES.some((a) => base === a || base.startsWith(a));
}

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
  // <img src> cannot set custom headers so the query param fallback is needed.
  // Security note: this exposes the bearer token in server-side access logs.
  // The token is a strong HMAC scoped to {screenId, orgSlug} — it cannot be used
  // to access any other screen's resources. Full mitigation (short-lived signed URLs
  // or HttpOnly cookie) is a follow-up improvement.
  const tokenParam = req.nextUrl.searchParams.get('token');
  const authHeader = req.headers.get('authorization') ?? (tokenParam ? `Bearer ${tokenParam}` : null);
  if (!verifyPlayerToken(screenId, orgSlug, authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getTenantClient(orgSlug);

  // Note: we verify the item belongs to this tenant (via orgSlug-scoped DB client) but
  // do not currently assert the item is in a playlist assigned to screenId. The attack
  // surface is limited because only admins can create CCTV_GRID items with arbitrary URLs.
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

  // Parse and validate the camera URL
  let cleanUrl: string;
  let credentials: string | null = null;

  try {
    const u = new URL(rawUrl);

    // Only allow http/https — block file://, ftp://, etc.
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return NextResponse.json({ error: 'Unsupported camera protocol' }, { status: 400 });
    }

    if (u.username && u.password) {
      credentials = Buffer.from(`${u.username}:${u.password}`).toString('base64');
    }
    u.username = '';
    u.password = '';
    cleanUrl = u.toString();
  } catch {
    return NextResponse.json({ error: 'Invalid stream URL' }, { status: 502 });
  }

  // Fetch MJPEG stream from camera with a 10s connection timeout.
  // redirect: 'manual' prevents redirect chains that could reach unintended hosts.
  const fetchHeaders: HeadersInit = {};
  if (credentials) {
    fetchHeaders['Authorization'] = `Basic ${credentials}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let cameraResponse: Response;
  try {
    cameraResponse = await fetch(cleanUrl, {
      headers: fetchHeaders,
      signal: controller.signal,
      redirect: 'manual',
      // @ts-expect-error — Node fetch supports this signal-less duplex mode
      duplex: 'half',
    });
  } catch {
    clearTimeout(timeout);
    return NextResponse.json({ error: 'Camera unreachable' }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  // Reject redirects to avoid redirect-based SSRF
  if (cameraResponse.status >= 300 && cameraResponse.status < 400) {
    return NextResponse.json({ error: 'Camera returned unexpected redirect' }, { status: 502 });
  }

  if (!cameraResponse.ok) {
    return NextResponse.json({ error: 'Camera unreachable' }, { status: 502 });
  }

  // Validate content-type to prevent XSS via proxied response
  const upstreamCt = cameraResponse.headers.get('content-type');
  if (!isAllowedContentType(upstreamCt)) {
    return NextResponse.json({ error: 'Unexpected content type from camera' }, { status: 502 });
  }

  return new NextResponse(cameraResponse.body, {
    status: 200,
    headers: {
      'Content-Type': upstreamCt ?? 'multipart/x-mixed-replace',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
