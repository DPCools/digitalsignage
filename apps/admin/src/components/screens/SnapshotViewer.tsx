'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
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
  // Always load through the authenticated proxy — snapshots/ is not in the public bucket policy
  const [url, setUrl] = useState(initialUrl ? `/api/admin/snapshot?screenId=${screenId}` : null);
  const [lightbox, setLightbox] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [capturing, setCapturing] = useState(false);
  // URL at the moment capture was triggered — used to detect when a new snapshot lands
  const snapshotBaselineRef = useRef<string | null>(initialUrl);
  const [pollEnabled, setPollEnabled] = useState(false);

  // Sync when server re-renders with a fresh snapshot URL after router.refresh().
  // Always add a cache-bust so the browser re-fetches the new image.
  useEffect(() => {
    setUrl(initialUrl ? `/api/admin/snapshot?screenId=${screenId}&t=${Date.now()}` : null);
  }, [initialUrl, screenId]);

  // Poll the DB every 2 s while waiting for the player to upload a new snapshot
  const screenPoll = trpc.screens.get.useQuery(
    { id: screenId },
    { enabled: pollEnabled, refetchInterval: pollEnabled ? 2000 : false }
  );

  useEffect(() => {
    if (!pollEnabled || !screenPoll.data) return;
    const newSnapshot = screenPoll.data.lastSnapshot;
    if (newSnapshot && newSnapshot !== snapshotBaselineRef.current) {
      // New snapshot detected — update display
      setPollEnabled(false);
      setCapturing(false);
      setRefreshedAt(new Date());
      setUrl(`/api/admin/snapshot?screenId=${screenId}&t=${Date.now()}`);
      router.refresh();
    }
  }, [screenPoll.data, pollEnabled, screenId, router]);

  // Safety timeout: stop polling after 30 s if the player never responds
  useEffect(() => {
    if (!pollEnabled) return;
    const t = setTimeout(() => {
      setPollEnabled(false);
      setCapturing(false);
    }, 30_000);
    return () => clearTimeout(t);
  }, [pollEnabled]);

  const [reloading, setReloading] = useState(false);
  const reloadScreen = trpc.screens.sendCommand.useMutation({
    onSuccess: () => { setReloading(true); setTimeout(() => setReloading(false), 3000); },
  });

  const sendCommand = trpc.screens.sendCommand.useMutation({
    onSuccess: () => setPollEnabled(true),
    onError: () => setCapturing(false),
  });
  // Keep a ref so the retry interval always calls the latest mutation object
  // without needing it as an effect dependency.
  const sendCommandRef = useRef(sendCommand);
  useEffect(() => { sendCommandRef.current = sendCommand; }, [sendCommand]);

  // Retry the screenshot command every 5 s while we're waiting for a snapshot.
  // Players reconnect frequently in dev; the first emit is often missed because
  // the socket event is published before the player re-joins the room.
  useEffect(() => {
    if (!pollEnabled) return;
    const retryTimer = setInterval(() => {
      sendCommandRef.current.mutate({ screenId, command: 'screenshot' });
    }, 5_000);
    return () => clearInterval(retryTimer);
  }, [pollEnabled, screenId]);

  const takeSnapshot = useCallback(() => {
    setCapturing(true);
    // Set baseline at click time so onSuccess always compares against the
    // snapshot URL that was current when the user triggered the capture.
    snapshotBaselineRef.current = initialUrl;
    sendCommand.mutate({ screenId, command: 'screenshot' });
  }, [screenId, sendCommand, initialUrl]);

  const refresh = useCallback(() => {
    if (!url) return;
    setRefreshing(true);
    setUrl(`/api/admin/snapshot?screenId=${screenId}&t=${Date.now()}`);
    setRefreshedAt(new Date());
    setTimeout(() => setRefreshing(false), 600);
  }, [url, screenId]);

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
              onClick={() => reloadScreen.mutate({ screenId, command: 'reload' })}
              disabled={reloading || reloadScreen.isPending}
              title="Force the player to reload its page and pick up new code"
              className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 hover:text-white transition-colors rounded-lg px-2.5 py-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reloadScreen.isPending ? 'animate-spin' : ''}`} />
              {reloading ? 'Reloading…' : 'Reload Screen'}
            </button>
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
