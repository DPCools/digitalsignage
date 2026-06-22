'use client';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Monitor, RefreshCw, X, ZoomIn, Camera } from 'lucide-react';
import { trpc } from '@/lib/trpc-client';

export function SnapshotViewer({
  initialUrl,
  screenName,
  screenId,
}: {
  initialUrl: string | null;
  screenName: string;
  screenId: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [lightbox, setLightbox] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [capturing, setCapturing] = useState(false);

  // Sync when server re-renders with a fresh snapshot URL after router.refresh()
  useEffect(() => { setUrl(initialUrl); }, [initialUrl]);

  const sendCommand = trpc.screens.sendCommand.useMutation({
    onSuccess: () => {
      // Give the player ~4 s to capture and upload before reloading server data
      setTimeout(() => {
        router.refresh();
        setCapturing(false);
        setRefreshedAt(new Date());
        // Optimistically cache-bust the img src so the browser re-fetches the
        // new snapshot even if initialUrl didn't change (player still uploading).
        setUrl(prev => {
          const base = (prev ?? `/api/admin/snapshot?screenId=${screenId}`)
            .replace(/[&?]t=\d+/, '');
          const sep = base.includes('?') ? '&' : '?';
          return `${base}${sep}t=${Date.now()}`;
        });
      }, 4000);
    },
    onError: () => setCapturing(false),
  });

  const takeSnapshot = useCallback(() => {
    setCapturing(true);
    sendCommand.mutate({ screenId, command: 'screenshot' });
  }, [screenId, sendCommand]);

  const refresh = useCallback(() => {
    if (!url) return;
    setRefreshing(true);
    // Strip any previous cache-bust param then append a fresh one
    const base = url.replace(/[&?]t=\d+/, '');
    const sep = base.includes('?') ? '&' : '?';
    setUrl(`${base}${sep}t=${Date.now()}`);
    setRefreshedAt(new Date());
    setTimeout(() => setRefreshing(false), 600);
  }, [url]);

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
                Updated {refreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            {url && (
              <button
                onClick={refresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Reload
              </button>
            )}
            <button
              onClick={takeSnapshot}
              disabled={capturing}
              className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 hover:text-white transition-colors rounded-lg px-2.5 py-1"
            >
              <Camera className={`w-3.5 h-3.5 ${capturing ? 'animate-pulse' : ''}`} />
              {capturing ? 'Capturing…' : 'Take Snapshot'}
            </button>
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
              <p className="text-xs text-gray-600">Click "Take Snapshot" above or wait for the player to auto-capture</p>
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
