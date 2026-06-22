'use client';
import { useState, useCallback } from 'react';
import { Monitor, RefreshCw, X, ZoomIn } from 'lucide-react';

export function SnapshotViewer({
  initialUrl,
  screenName,
}: {
  initialUrl: string | null;
  screenName: string;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [lightbox, setLightbox] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const refresh = useCallback(() => {
    if (!initialUrl) return;
    setRefreshing(true);
    // Cache-bust by appending a timestamp; the MinIO key is the same file
    const base = initialUrl.split('?')[0];
    setUrl(`${base}?t=${Date.now()}`);
    setRefreshedAt(new Date());
    // Brief spinner for UX feedback
    setTimeout(() => setRefreshing(false), 600);
  }, [initialUrl]);

  return (
    <>
      {/* Snapshot panel */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Last Snapshot
          </h2>
          <div className="flex items-center gap-3">
            {refreshedAt && (
              <span className="text-xs text-gray-500">
                Refreshed {refreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            {initialUrl && (
              <button
                onClick={refresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            )}
          </div>
        </div>

        <div className="relative bg-black aspect-video group">
          {url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Snapshot of ${screenName}`}
                className="w-full h-full object-contain"
              />
              <button
                onClick={() => setLightbox(true)}
                className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors"
                title="View full size"
              >
                <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Monitor className="w-14 h-14 text-gray-700" />
              <p className="text-sm text-gray-500">No snapshot yet</p>
              <p className="text-xs text-gray-600">Player sends a screenshot every few minutes</p>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
            onClick={() => setLightbox(false)}
          >
            <X className="w-6 h-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`Full-size snapshot of ${screenName}`}
            className="max-w-full max-h-full object-contain rounded shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
