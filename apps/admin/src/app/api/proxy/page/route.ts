import { NextRequest, NextResponse } from 'next/server';
import { verifyPlayerToken, verifyStreamToken, isSafeOrgSlug, isSafeId } from '@/lib/player-auth';

// Build response headers: strip iframe-blocking headers, drop hop-by-hop headers
function buildResponseHeaders(upstream: Headers): Headers {
  const out = new Headers();
  for (const [key, value] of upstream.entries()) {
    const lower = key.toLowerCase();
    // Drop iframe-blocking header entirely
    if (lower === 'x-frame-options') continue;
    // Drop hop-by-hop headers that become invalid after proxying
    if (lower === 'transfer-encoding') continue;
    if (lower === 'content-encoding') continue; // already decoded by fetch
    if (lower === 'content-length') continue;   // may change after rewriting
    // Strip frame-ancestors from CSP but keep the rest
    if (lower === 'content-security-policy') {
      const cleaned = value
        .split(';')
        .map((d) => d.trim())
        .filter((d) => !d.toLowerCase().startsWith('frame-ancestors'))
        .join('; ')
        .trim();
      if (cleaned) out.set(key, cleaned);
      continue;
    }
    out.set(key, value);
  }
  out.set('Cache-Control', 'no-store');
  return out;
}

// Inject <base href="pageUrl"> so relative URLs in the proxied HTML
// resolve to the original site rather than our admin origin.
function injectBase(html: string, pageUrl: string): string {
  if (/<base[\s>]/i.test(html)) return html; // already has <base>
  const tag = `<base href="${pageUrl.replace(/"/g, '&quot;')}">`;
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/(<head[^>]*>)/i, `$1${tag}`);
  }
  return tag + html;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const orgSlug   = searchParams.get('orgSlug');
  const screenId  = searchParams.get('screenId');
  const targetUrl = searchParams.get('url');
  const token     = searchParams.get('token');

  if (!orgSlug || !screenId || !targetUrl) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  if (!isSafeOrgSlug(orgSlug) || !isSafeId(screenId)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }

  const bearerOk = verifyPlayerToken(screenId, orgSlug, req.headers.get('authorization'));
  const streamOk = verifyStreamToken(screenId, orgSlug, token);
  if (!bearerOk && !streamOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate URL — http/https only
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return NextResponse.json({ error: 'Unsupported protocol' }, { status: 400 });
  }

  // Strip inline credentials from URL; send as Authorization header if present
  let cleanTarget = targetUrl;
  const extraHeaders: HeadersInit = {};
  if (parsedUrl.username) {
    const creds = `${decodeURIComponent(parsedUrl.username)}:${decodeURIComponent(parsedUrl.password)}`;
    extraHeaders['Authorization'] = `Basic ${Buffer.from(creds).toString('base64')}`;
    parsedUrl.username = '';
    parsedUrl.password = '';
    cleanTarget = parsedUrl.toString();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  let upstream: Response;
  try {
    upstream = await fetch(cleanTarget, {
      signal: controller.signal,
      // Follow redirects (expected for http→https, www→non-www, etc.)
      redirect: 'follow',
      headers: {
        // Realistic UA so servers don't block headless requests
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        ...extraHeaders,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Page unreachable' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: `Upstream ${upstream.status}` }, { status: 502 });
  }

  const upstreamCt = upstream.headers.get('content-type') ?? '';
  const responseHeaders = buildResponseHeaders(upstream.headers);

  // Non-HTML (fonts, images loaded via proxy url rewriting) — stream through unchanged
  if (!upstreamCt.toLowerCase().includes('text/html')) {
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  // HTML — inject <base href> so relative URLs resolve to the original site
  const html = await upstream.text();
  // upstream.url is the final URL after all redirects
  const rewritten = injectBase(html, upstream.url);

  responseHeaders.set('Content-Type', 'text/html; charset=utf-8');

  return new NextResponse(rewritten, {
    status: 200,
    headers: responseHeaders,
  });
}
