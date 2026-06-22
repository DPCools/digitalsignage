import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { spawn, type ChildProcess } from 'child_process';
import { getTenantClient } from '@signflow/db';
import { verifyPlayerToken, verifyStreamToken, isSafeOrgSlug, isSafeId } from '@/lib/player-auth';
import { tryAcquireTranscode, releaseTranscode, RTSP_HARD_CAP } from '@/lib/rtsp-semaphore';
import { SETTING_DEFAULTS } from '@/server/trpc/routers/settings';

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

// Transcode an RTSP stream to MJPEG using FFmpeg.
// FFmpeg's mpjpeg muxer outputs multipart/x-mixed-replace with boundary "ffmpeg".
//
// Security note — credentials in argv:
// FFmpeg's RTSP handler reads auth exclusively from the URL; there is no
// separate credential flag (e.g. -rtsp_user / -rtsp_pass) that keeps the
// secret out of the process argv. To avoid embedding the raw URL in this
// process's spawn() args array (which appears in code audit and error logs),
// we pass the full URL via an environment variable (SF_RTSP_URL) and let
// the shell expand it. This means the /bin/sh process argv contains only a
// template string — no credentials. After `exec`, the shell is replaced by
// ffmpeg whose argv will contain the expanded URL (unavoidable with FFmpeg
// RTSP auth). The ffmpeg process is short-lived: it dies the moment the
// client disconnects. Credentials in ffmpeg's argv are readable only by
// processes with the same OS user or root.
function streamRtsp(rtspUrl: string, fps: number): NextResponse {
  const ffmpeg = spawn('/bin/sh', [
    '-c',
    `exec /usr/bin/ffmpeg -loglevel quiet -rtsp_transport tcp -i "$SF_RTSP_URL" -f mpjpeg -q:v 5 -r ${fps} pipe:1`,
  ], {
    stdio: ['ignore', 'pipe', 'ignore'],
    env: {
      ...process.env,
      SF_RTSP_URL: rtspUrl,
    },
  }) as unknown as ChildProcess;

  const release = () => releaseTranscode();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      ffmpeg.stdout!.on('data', (chunk: Buffer) => {
        try { controller.enqueue(new Uint8Array(chunk)); } catch { /* stream closed */ }
      });
      ffmpeg.stdout!.on('end', () => {
        release();
        try { controller.close(); } catch { /* already closed */ }
      });
      ffmpeg.on('error', () => {
        release();
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      release();
      try { ffmpeg.kill('SIGKILL'); } catch { /* already dead */ }
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'multipart/x-mixed-replace;boundary=ffmpeg',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
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

  const rawUrl = streams[streamIndex].url?.trim();
  if (!rawUrl) {
    return NextResponse.json({ error: 'Stream URL not configured' }, { status: 404 });
  }

  // Parse the URL to extract credentials, then dispatch to the right handler.
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid stream URL' }, { status: 400 });
  }

  const username = parsedUrl.username ? decodeURIComponent(parsedUrl.username) : null;
  const password = parsedUrl.username ? decodeURIComponent(parsedUrl.password) : null;

  // ── RTSP path ──────────────────────────────────────────────────────────────
  // Transcode RTSP streams to MJPEG via FFmpeg; the proxy serves the output as
  // multipart/x-mixed-replace so the player's <img> tag can display live video.
  if (parsedUrl.protocol === 'rtsp:' || parsedUrl.protocol === 'rtsps:') {
    // Read org settings for FPS cap and concurrency limit
    const settingRows = await db.orgSetting.findMany({
      where: { key: { in: ['rtsp_fps', 'rtsp_max_transcodes'] } },
    });
    const settingMap: Record<string, string> = { ...SETTING_DEFAULTS };
    for (const row of settingRows) settingMap[row.key] = row.value;

    const fps    = Math.min(30, Math.max(1, parseInt(settingMap.rtsp_fps, 10) || 8));
    const maxTx  = Math.min(RTSP_HARD_CAP, Math.max(1, parseInt(settingMap.rtsp_max_transcodes, 10) || 4));

    if (!tryAcquireTranscode(maxTx)) {
      return NextResponse.json(
        { error: `Transcode limit reached (${maxTx} active). Try again shortly.` },
        { status: 503 }
      );
    }

    return streamRtsp(rawUrl, fps);
  }

  // ── HTTP/HTTPS path ─────────────────────────────────────────────────────────
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return NextResponse.json({ error: 'Unsupported camera protocol' }, { status: 400 });
  }

  // Strip credentials from URL before fetching (sent via Authorization header instead)
  parsedUrl.username = '';
  parsedUrl.password = '';
  const cleanUrl = parsedUrl.toString();

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
