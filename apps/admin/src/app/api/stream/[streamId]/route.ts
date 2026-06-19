import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { getTenantClient } from '@signflow/db';
import { verifyPlayerToken, verifyStreamToken, isSafeOrgSlug, isSafeId } from '@/lib/player-auth';

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

// Compute an HTTP Digest-auth Authorization header.
// Returns null if the challenge uses an unsupported algorithm.
function computeDigestAuth(
  method: string,
  uri: string,
  username: string,
  password: string,
  wwwAuth: string
): string | null {
  const realm  = wwwAuth.match(/realm="([^"]+)"/)?.[1];
  const nonce  = wwwAuth.match(/nonce="([^"]+)"/)?.[1];
  const qop    = wwwAuth.match(/qop="?([^",\s]+)"?/)?.[1];
  const algo   = (wwwAuth.match(/algorithm=([^\s,]+)/)?.[1] ?? 'MD5').toUpperCase();

  if (!realm || !nonce || algo !== 'MD5') return null;

  const md5 = (s: string) => createHash('md5').update(s).digest('hex');
  const ha1  = md5(`${username}:${realm}:${password}`);
  const ha2  = md5(`${method}:${uri}`);

  if (qop === 'auth') {
    const nc     = '00000001';
    const cnonce = randomBytes(4).toString('hex');
    const resp   = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
    return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", nc=${nc}, cnonce="${cnonce}", qop=${qop}, response="${resp}", algorithm=${algo}`;
  }
  // No qop (RFC 2069 mode — rare but valid)
  const resp = md5(`${ha1}:${nonce}:${ha2}`);
  return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${resp}", algorithm=${algo}`;
}

async function fetchCamera(
  url: string,
  authHeader: string | null,
  timeoutMs = 10_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: authHeader ? { Authorization: authHeader } : {},
      signal: controller.signal,
      redirect: 'manual',
      // @ts-expect-error — Node fetch supports this signal-less duplex mode
      duplex: 'half',
    });
  } finally {
    clearTimeout(timer);
  }
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

  const orgSlug  = req.nextUrl.searchParams.get('orgSlug');
  const screenId = req.nextUrl.searchParams.get('screenId');

  if (!orgSlug || !screenId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  if (!isSafeOrgSlug(orgSlug) || !isSafeId(screenId) || !isSafeId(contentItemId)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }

  // Two accepted auth paths:
  // 1. Authorization: Bearer <playerToken> header (server-to-server / testing)
  // 2. ?token=<streamToken> query param — used by <img src> which cannot set headers.
  const tokenParam = req.nextUrl.searchParams.get('token');
  const bearerOk  = verifyPlayerToken(screenId, orgSlug, req.headers.get('authorization'));
  const streamOk  = verifyStreamToken(screenId, orgSlug, tokenParam);
  if (!bearerOk && !streamOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getTenantClient(orgSlug);

  const item = await db.contentItem.findUnique({ where: { id: contentItemId } });

  if (!item || item.type !== 'CCTV_GRID') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const meta    = item.metadata as { streams?: Array<{ url: string; label?: string }> } | null;
  const streams = meta?.streams;

  if (!streams || streamIndex >= streams.length) {
    return NextResponse.json({ error: 'Stream index out of range' }, { status: 404 });
  }

  const rawUrl = streams[streamIndex].url;
  if (!rawUrl) {
    return NextResponse.json({ error: 'Stream URL not configured' }, { status: 404 });
  }

  // Parse and validate the camera URL, stripping inline credentials
  let cleanUrl: string;
  let username: string | null = null;
  let password: string | null = null;

  try {
    const u = new URL(rawUrl);

    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return NextResponse.json({ error: 'Unsupported camera protocol' }, { status: 400 });
    }

    if (u.username) {
      username = decodeURIComponent(u.username);
      password = decodeURIComponent(u.password);
    }
    u.username = '';
    u.password = '';
    cleanUrl = u.toString();
  } catch {
    return NextResponse.json({ error: 'Invalid stream URL' }, { status: 400 });
  }

  // Build the initial auth header (Basic if credentials provided)
  const basicAuth = username
    ? `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
    : null;

  // Attempt 1 — try with Basic auth (or no auth)
  let cameraResponse: Response;
  try {
    cameraResponse = await fetchCamera(cleanUrl, basicAuth);
  } catch {
    return NextResponse.json({ error: 'Camera unreachable' }, { status: 502 });
  }

  // Reject redirects to avoid redirect-based SSRF
  if (cameraResponse.status >= 300 && cameraResponse.status < 400) {
    return NextResponse.json({ error: 'Camera returned unexpected redirect' }, { status: 502 });
  }

  // If Basic auth failed with 401 and the camera wants Digest, retry with Digest auth.
  // Axis, Hikvision, and Dahua cameras typically require Digest MD5.
  if (cameraResponse.status === 401 && username) {
    const wwwAuth = cameraResponse.headers.get('www-authenticate') ?? '';
    void cameraResponse.body?.cancel(); // release the 401 response body

    if (wwwAuth.toLowerCase().startsWith('digest')) {
      const urlPath   = new URL(cleanUrl).pathname + new URL(cleanUrl).search;
      const digestHdr = computeDigestAuth('GET', urlPath, username, password ?? '', wwwAuth);

      if (digestHdr) {
        try {
          cameraResponse = await fetchCamera(cleanUrl, digestHdr);
        } catch {
          return NextResponse.json({ error: 'Camera unreachable' }, { status: 502 });
        }
      }
    }
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
