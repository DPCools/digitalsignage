import { NextRequest, NextResponse } from 'next/server';
import { isIP } from 'net';
import { promises as dns } from 'dns';
import { getTenantClient } from '@signflow/db';
import { verifyAndSyncPlayerToken, verifyStreamToken, isSafeOrgSlug, isSafeId } from '@/lib/player-auth';

// ---------------------------------------------------------------------------
// Security notes
// ---------------------------------------------------------------------------
// SSRF: Only http/https are permitted. The initial URL and every redirect
//   Location is checked via isBlockedHost() which:
//     - Rejects loopback (127.0.0.0/8, ::1, 0.0.0.0), link-local /
//       cloud-metadata (169.254.0.0/16, fe80::/10), and unspecified (::).
//     - Handles literal IPv4 (incl. WHATWG-normalised decimal/hex) and IPv6
//       (incl. ::ffff: mapped forms in both dotted and hex notation).
//     - DNS-resolves hostnames and checks every returned address.
//   Private LAN IPs (10/8, 172.16/12, 192.168/16) are intentionally allowed
//   — the primary use case is internal dashboards on a signage LAN where the
//   admin is trusted to configure URLs.
//
// Same-origin content injection: mitigated by stream-token auth, CSP sandbox,
//   and X-Content-Type-Options: nosniff on every proxied response. For
//   production with sensitive admin sessions, serve from a dedicated subdomain.
//
// Token in URL: short-lived HMAC (10–20 min) — accepted tradeoff for iframes.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// IP range helpers — no third-party deps
// ---------------------------------------------------------------------------

function ipv4ToU32(ip: string): number {
  return ip.split('.').reduce((n, o) => n * 256 + parseInt(o, 10), 0) >>> 0;
}

// Ranges blocked as source or redirect destination.
// Private LAN ranges (10/8, 172.16/12, 192.168/16) intentionally omitted.
const BLOCKED_V4: [number, number][] = [
  [ipv4ToU32('0.0.0.0'),     ipv4ToU32('0.255.255.255')],   // 0.0.0.0/8     unspecified
  [ipv4ToU32('127.0.0.0'),   ipv4ToU32('127.255.255.255')], // 127.0.0.0/8   loopback
  [ipv4ToU32('169.254.0.0'), ipv4ToU32('169.254.255.255')], // 169.254.0.0/16 link-local / IMDS
];

function isBlockedIPv4(ip: string): boolean {
  const n = ipv4ToU32(ip);
  return BLOCKED_V4.some(([lo, hi]) => n >= lo && n <= hi);
}

function isBlockedIPv6(ip: string): boolean {
  const n = ip.toLowerCase();
  if (n === '::1' || n === '0:0:0:0:0:0:0:1') return true;  // loopback
  if (n === '::' || n === '0:0:0:0:0:0:0:0') return true;   // unspecified
  if (/^fe[89ab][0-9a-f]?:/i.test(n)) return true;           // fe80::/10 link-local

  // ::ffff:x.x.x.x  — IPv4-mapped, dotted notation
  const dotted = n.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dotted) return isBlockedIPv4(dotted[1]);

  // ::ffff:xxxx:xxxx — IPv4-mapped, hex notation (e.g. ::ffff:7f00:1 = 127.0.0.1)
  const hexMapped = n.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMapped) {
    const hi = parseInt(hexMapped[1], 16);
    const lo = parseInt(hexMapped[2], 16);
    const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    return isBlockedIPv4(v4);
  }

  return false;
}

// Returns true if the host resolves to or IS a blocked address.
async function isBlockedHost(hostname: string): Promise<boolean> {
  // Strip IPv6 brackets inserted by the WHATWG URL parser
  const h = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname;

  const ipVer = isIP(h);
  if (ipVer === 4) return isBlockedIPv4(h);
  if (ipVer === 6) return isBlockedIPv6(h);

  // Literal hostname aliases
  if (/^localhost(\.localdomain)?$/i.test(h)) return true;

  // DNS resolution — check every returned address
  try {
    const addrs = await dns.lookup(h, { all: true });
    return addrs.some(({ address, family }) =>
      family === 4 ? isBlockedIPv4(address) : isBlockedIPv6(address)
    );
  } catch {
    return false; // DNS failure — the subsequent fetch will fail naturally
  }
}

// ---------------------------------------------------------------------------
// Safe redirect follower
// ---------------------------------------------------------------------------

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
    if (await isBlockedHost(next.hostname)) {
      throw new Error(`Redirect to blocked address: ${next.hostname}`);
    }

    currentUrl = next.toString();
  }

  throw new Error('Too many redirects');
}

// ---------------------------------------------------------------------------
// Response header helpers
// ---------------------------------------------------------------------------

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
    out.set(
      'Content-Security-Policy',
      'sandbox allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox'
    );
  }
  return out;
}

function injectBase(html: string, pageUrl: string): string {
  if (/<base[\s>]/i.test(html)) return html;
  const safe = pageUrl
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;');
  const tag = `<base href="${safe}">`;
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/(<head[^>]*>)/i, `$1${tag}`);
  }
  return tag + html;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

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

  const db = getTenantClient(orgSlug);
  const bearerOk = await verifyAndSyncPlayerToken(db, screenId, orgSlug, req.headers.get('authorization'));
  const streamOk = verifyStreamToken(screenId, orgSlug, token);
  if (!bearerOk && !streamOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate URL — http/https only; blocked ranges rejected
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return NextResponse.json({ error: 'Unsupported protocol' }, { status: 400 });
  }
  if (await isBlockedHost(parsedUrl.hostname)) {
    return NextResponse.json({ error: 'URL not permitted' }, { status: 400 });
  }

  // Strip inline credentials; pass as Authorization header if present
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

  return new NextResponse(rewritten, { status: 200, headers: responseHeaders });
}
