'use client';
import { useEffect, useRef, useState } from 'react';
import type { PlaylistItemConfig } from '@signflow/types';
import { getCachedAsset } from '@/lib/db';

const VIDEO_ERROR_ADVANCE_MS = 4000;

export function ContentPlayer({ item, onVideoEnd }: { item: PlaylistItemConfig; onVideoEnd?: () => void }) {
  const [src, setSrc] = useState(item.url);
  const [videoError, setVideoError] = useState(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Blob cache only for non-video — blob URLs break HTTP range requests and fail on TV browsers
  useEffect(() => {
    if (item.type === 'VIDEO') return;
    getCachedAsset(item.url).then((cached) => {
      if (cached) setSrc(cached);
    });
  }, [item.url, item.type]);

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
          src={src}
          alt=""
          style={{ ...fill, objectFit: 'contain', background: '#000' }}
          loading="eager"
          onError={() => setSrc(item.url)}
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
          src={src}
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

    default:
      return null;
  }
}
