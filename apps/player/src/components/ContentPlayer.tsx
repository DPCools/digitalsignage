'use client';
import { useEffect, useRef, useState } from 'react';
import type { PlaylistItemConfig } from '@signflow/types';
import { getCachedAsset } from '@/lib/db';

export function ContentPlayer({ item }: { item: PlaylistItemConfig }) {
  const [src, setSrc] = useState(item.url);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    getCachedAsset(item.url).then((cached) => {
      if (cached) setSrc(cached);
    });
  }, [item.url]);

  useEffect(() => {
    if (item.type === 'VIDEO' && videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => null);
    }
  }, [item.type, src]);

  switch (item.type) {
    case 'IMAGE':
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="w-full h-full object-contain"
          loading="eager"
          onError={() => setSrc(item.url)}
        />
      );

    case 'VIDEO':
      return (
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-contain"
          muted
          autoPlay
          playsInline
          loop={false}
          onError={() => setSrc(item.url)}
        />
      );

    case 'HTML_TEMPLATE':
      // allow-scripts only — omitting allow-same-origin forces opaque origin,
      // preventing the frame from escaping the sandbox and accessing parent state
      return (
        <iframe
          src={src}
          className="w-full h-full border-0"
          sandbox="allow-scripts"
          title="content"
        />
      );

    case 'PDF':
      return (
        <iframe
          src={`${item.url}#toolbar=0&navpanes=0&scrollbar=0`}
          className="w-full h-full border-0"
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
