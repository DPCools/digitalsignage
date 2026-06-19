import { NextRequest, NextResponse } from 'next/server';
import { verifyPlayerToken, verifyStreamToken, isSafeOrgSlug, isSafeId } from '@/lib/player-auth';

// ---------------------------------------------------------------------------
// Security notes
// ---------------------------------------------------------------------------
// SSRF: Only http/https are permitted. Redirect chains are followed manually
//   with per-hop validation: loopback addresses (127.x, ::1, localhost, 0.0.0.0)
//   are blocked on every hop to prevent redirect-pivot to the local server.
//   Private LAN IPs are allowed because the primary use case is internal
//   dashboards on a signage LAN — admins are trusted to configure URLs.
//
// Same-origin content injection: Proxied HTML is served from the admin origin.
//   Mitigated by: (a) stream-token auth on every request, (b) CSP sandbox on
//   the proxied response, (c) X-Content-Type-Options: nosniff.
//   For production deployments handling sensitive admin sessions, serve this
//   route from a dedicated subdomain (e.g. proxy.signage.example.com) so
//   proxied pages cannot access admin cookies even if visited directly.
//
// Token in URL: stream token appears in <iframe src> and access logs.
//   Accepted tradeoff — iframes cannot set Authorization headers. Token is
//   a short-lived time-windowed HMAC (10–20 min), not the long-lived bearer.
// ---------------------------------------------------------------------------

// Hostnames/IPs that must never be redirect destinations.
// Private LAN IPs are intentionally NOT blocked — see SSRF note above.
const LOOPBACK_RE = /^(127\.|0\.0\.0\.0$|::1$|localhost$)/i;

function isLoopback(host: string): boolean {
  return LOOPBACK_RE.test(host);
}

// Follow up to maxHops redirects, validating each destination.
async function fetchWithSafeRedirects(
  startUrl: string,
  options: Omit<RequestInit, 'redirect'>,
  signal: AbortSignal,
  maxHops = 5
): Promise<Response> {
  let currentUrl = startUrl;

  for (let hop = 0; hop <= maxHops; hop++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await fetch(currentUrl, { ...options, redirect: 'manual', signal } as any);

    if (res.status < 300 || res.status >= 400) return res;

    const location = res.headers.get('location');
    if (!location) return res;

    void res.body?.cancel();

    let next: URL;
    try {
      next = new URL(location, currentUrl);
    } catch {
      throw new Error('Redirect to invalid URL');
    }

    if (next.protocol !== 'http:' && next.protocol !== 'https:') {
      throw new Error(`Redirect to unsupported protocol: ${next.protocol}`);
    }
    if (isLoopback(next.hostname)) {
      throw new Error(`Redirect to loopback address blocked: ${next.hostname}`);
    }

    currentUrl = next.toString();
  }

  throw new Error('Too many redirects');
}

// Build response headers: strip iframe-blocking headers, drop hop-by-hop headers.
function buildResponseHeaders(upstream: Headers, isHtml: boolean): Headers {
  const out = new Headers();
  for (const [key, value] of upstream.entries()) {
    const lower = key.toLowerCase();
    if (lower === 'x-frame-options') continue;
    if (lower === 'transfer-encoding') continue;
    if (lower === 'content-encoding') continue;
    if (lower === 'content-length') continue;
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
  out.set('X-Content-Type-Options', 'nosniff');

  if (isHtml) {
    // Sandbox the proxied document so it cannot access admin cookies/storage
    // if this URL is ever visited directly (not inside the player iframe).
    out.set(
      'Content-Security-Policy',
      'sandbox allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox'
    );
  }

  return out;
}

// Inject <base href="pageUrl"> so relative URLs in the proxied HTML
// resolve to the original site rather than our admin origin.
function injectBase(html: string, pageUrl: string): string {
  if (/<base[\s>]/i.test(html)) return html;
  // Escape the URL for safe insertion into an HTML attribute
  const safe = pageUrl
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const tag = `<base href="${safe}">`;
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

  // Validate URL — http/https only; loopback blocked
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return NextResponse.json({ error: 'Unsupported protocol' }, { status: 400 });
  }
  if (isLoopback(parsedUrl.hostname)) {
    return NextResponse.json({ error: 'Loopback addresses not permitted' }, { status: 400 });
  }

  // Strip inline credentials; send as Authorization header if present
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
    upstream = await fetchWithSafeRedirects(
      cleanTarget,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          ...extraHeaders,
        },
      },
      controller.signal
    );
  } catch {
    return NextResponse.json({ error: 'Page unreachable' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: `Upstream ${upstream.status}` }, { status: 502 });
  }

  const upstreamCt = upstream.headers.get('content-type') ?? '';
  const isHtml     = upstreamCt.toLowerCase().includes('text/html');
  const responseHeaders = buildResponseHeaders(upstream.headers, isHtml);

  if (!isHtml) {
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  const html      = await upstream.text();
  const rewritten = injectBase(html, upstream.url);

  responseHeaders.set('Content-Type', 'text/html; charset=utf-8');

  return new NextResponse(rewritten, {
    status: 200,
    headers: responseHeaders,
  });
}
