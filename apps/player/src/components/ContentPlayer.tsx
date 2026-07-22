'use client';
import { useEffect, useRef, useState } from 'react';
import type { PlaylistItemConfig } from '@signflow/types';

const VIDEO_ERROR_ADVANCE_MS = 4000;

const ADMIN_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

// ---------------------------------------------------------------------------
// WebPagePlayer — renders an iframe that auto-refreshes at a configured interval
// ---------------------------------------------------------------------------

function WebPagePlayer({ url, refreshSecs, fill, orgSlug, screenId, streamToken }: {
  url: string;
  refreshSecs: number | null;
  fill: React.CSSProperties;
  orgSlug?: string;
  screenId?: string;
  streamToken?: string;
}) {
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!refreshSecs || refreshSecs <= 0) return;
    const t = setInterval(() => setKey((k) => k + 1), refreshSecs * 1000);
    return () => clearInterval(t);
  }, [refreshSecs]);

  // Route through the admin proxy so X-Frame-Options / CSP frame-ancestors headers
  // are stripped server-side. Without this, most sites refuse to load in an iframe.
  const proxyUrl = (orgSlug && screenId && streamToken)
    ? `${ADMIN_BASE}/api/proxy/page?url=${encodeURIComponent(url)}&orgSlug=${encodeURIComponent(orgSlug)}&screenId=${encodeURIComponent(screenId)}&token=${encodeURIComponent(streamToken)}`
    : null;

  if (!proxyUrl) {
    // Blank while stream token initialises (usually < 1s after first config load)
    return <div style={{ ...fill, background: '#000' }} />;
  }

  return (
    <iframe
      key={key}
      src={proxyUrl}
      style={{ ...fill, border: 'none' }}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      title="web page"
      referrerPolicy="no-referrer"
    />
  );
}

// ---------------------------------------------------------------------------
// CctvGrid — renders a 2×2 grid of MJPEG streams via the admin proxy
// ---------------------------------------------------------------------------

interface CctvStream {
  url: string;
  label?: string;
}

function CctvGrid({ streams, contentItemId, fill, screenId, orgSlug, streamToken }: {
  streams: CctvStream[];
  contentItemId: string;
  fill: React.CSSProperties;
  screenId: string;
  orgSlug: string;
  streamToken?: string;
}) {
  const [offlineMap, setOfflineMap] = useState<Record<number, boolean>>({});
  const retryTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Clean up retry timers on unmount
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(retryTimers.current).forEach(clearTimeout);
    };
  }, []);

  const handleError = (index: number) => {
    setOfflineMap((prev) => ({ ...prev, [index]: true }));
    // Retry after 10 seconds by toggling back to online — the img src stays the same
    // so the browser will re-attempt the request on next render
    retryTimers.current[index] = setTimeout(() => {
      setOfflineMap((prev) => ({ ...prev, [index]: false }));
    }, 10_000);
  };

  const cols = streams.length >= 2 ? 2 : 1;

  return (
    <div
      style={{
        ...fill,
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${Math.ceil(streams.length / cols)}, 1fr)`,
        gap: 2,
        background: '#000',
      }}
    >
      {streams.map((stream, index) => {
        const proxyUrl = streamToken
          ? `${ADMIN_BASE}/api/stream/${encodeURIComponent(contentItemId)}-${index}?orgSlug=${encodeURIComponent(orgSlug)}&screenId=${encodeURIComponent(screenId)}&token=${encodeURIComponent(streamToken)}`
          : null;

        return (
          <div key={index} style={{ position: 'relative', overflow: 'hidden', background: '#111' }}>
            {offlineMap[index] || !proxyUrl ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#222',
                  color: '#666',
                  fontFamily: 'sans-serif',
                  fontSize: '1.2vw',
                }}
              >
                Camera offline
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proxyUrl}
                alt={stream.label ?? `Camera ${index + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={() => handleError(index)}
              />
            )}
            {stream.label && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 6,
                  left: 6,
                  background: 'rgba(0,0,0,0.55)',
                  color: '#fff',
                  fontSize: '0.9vw',
                  fontFamily: 'sans-serif',
                  padding: '2px 6px',
                  borderRadius: 3,
                  pointerEvents: 'none',
                }}
              >
                {stream.label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContentPlayer
// ---------------------------------------------------------------------------

export function ContentPlayer({
  item,
  screenId,
  orgSlug,
  streamToken,
  onVideoEnd,
}: {
  item: PlaylistItemConfig;
  screenId?: string;
  orgSlug?: string;
  streamToken?: string;
  onVideoEnd?: () => void;
}) {
  const [videoError, setVideoError] = useState(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset error state when item changes
  useEffect(() => {
    setVideoError(false);
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [item.id]);

  const fill: React.CSSProperties = {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
  };

  const tryPlay = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    e.currentTarget.play().catch(() => null);
  };

  switch (item.type) {
    case 'IMAGE':
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.url}
          alt=""
          style={{ ...fill, objectFit: 'contain', background: '#000' }}
          loading="eager"
        />
      );

    case 'VIDEO':
      if (videoError) {
        return (
          <div style={{ ...fill, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111', color: '#666', gap: '0.5rem' }}>
            <span style={{ fontSize: '3vw' }}>⚠</span>
            <span style={{ fontSize: '1.5vw', fontFamily: 'sans-serif' }}>Video unavailable</span>
          </div>
        );
      }
      return (
        // No crossOrigin attribute here on purpose — the element's own request
        // stays no-cors/opaque, which is fine for playback. Offline/Range-sliced
        // caching doesn't depend on this element's request mode at all: the
        // service worker (next.config.ts) caches a real, non-opaque copy ahead
        // of time via assetCache.ts's plain fetch(url, { mode: 'cors' }), then
        // slices *that* cached copy to serve this element's range requests from
        // Cache Storage. Adding crossOrigin here would just start requiring
        // CORS for this element's requests too, for no benefit — don't "fix" it.
        <video
          // key forces a fresh element on item change — no stale src or paused state
          key={item.id}
          src={item.url}
          style={{ ...fill, objectFit: 'contain', background: '#000' }}
          muted
          autoPlay
          playsInline
          preload="auto"
          loop={false}
          // Multiple play triggers for TV browsers that don't honour autoPlay
          onLoadedMetadata={tryPlay}
          onCanPlay={tryPlay}
          onEnded={onVideoEnd}
          onError={(e) => {
            const err = (e.currentTarget as HTMLVideoElement).error;
            console.error('[video] playback error', err?.code, err?.message);
            setVideoError(true);
            // Advance playlist after a short pause so a broken video doesn't freeze the screen
            advanceTimerRef.current = setTimeout(() => onVideoEnd?.(), VIDEO_ERROR_ADVANCE_MS);
          }}
        />
      );

    case 'HTML_TEMPLATE':
      return (
        <iframe
          src={item.url}
          style={{ ...fill, border: 'none' }}
          sandbox="allow-scripts"
          title="content"
        />
      );

    case 'PDF':
      return (
        <iframe
          src={`${item.url}#toolbar=0&navpanes=0&scrollbar=0`}
          style={{ ...fill, border: 'none' }}
          sandbox="allow-same-origin"
          title="PDF"
        />
      );

    case 'RSS_FEED':
      return null;

    case 'WEB_PAGE': {
      const refreshSecs = (item.metadata?.refreshInterval as number | null) ?? null;
      return <WebPagePlayer url={item.url} refreshSecs={refreshSecs} fill={fill} orgSlug={orgSlug} screenId={screenId} streamToken={streamToken} />;
    }

    case 'CCTV_GRID': {
      const streams = (item.metadata?.streams as Array<{ url: string; label?: string }> | undefined) ?? [];
      return (
        <CctvGrid
          streams={streams}
          contentItemId={item.contentItemId}
          fill={fill}
          screenId={screenId ?? ''}
          orgSlug={orgSlug ?? ''}
          streamToken={streamToken}
        />
      );
    }

    default:
      return null;
  }
}
