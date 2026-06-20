'use client';
import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { RefreshCw } from 'lucide-react';

const ONLINE_THRESHOLD_MS = 90_000;

function isOnline(lastHeartbeat: Date | string | null): boolean {
  if (!lastHeartbeat) return false;
  return Date.now() - new Date(lastHeartbeat).getTime() < ONLINE_THRESHOLD_MS;
}

function useTimeAgo(date: Date | string | null): string {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  if (!date) return 'Never';
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 10)   return 'just now';
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

type HealthRow = {
  id: string;
  name: string;
  group: string | null;
  orientation: string;
  lastHeartbeat: Date | string | null;
  currentPlaylist: string | null;
  currentContent: string | null;
};

function HealthRow({ screen }: { screen: HealthRow }) {
  const online  = isOnline(screen.lastHeartbeat);
  const lastSeen = useTimeAgo(screen.lastHeartbeat);

  return (
    <tr className="border-b border-gray-800/60 hover:bg-gray-800/20 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`shrink-0 w-2 h-2 rounded-full ${
              online ? 'bg-green-400 animate-pulse' : 'bg-gray-600'
            }`}
          />
          <span className="font-medium text-white text-sm">{screen.name}</span>
          {screen.orientation === 'PORTRAIT' && (
            <span className="text-xs text-gray-500 border border-gray-700 rounded px-1">↕</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
            online
              ? 'bg-green-500/15 text-green-400'
              : 'bg-gray-700/60 text-gray-400'
          }`}
        >
          {online ? 'Online' : 'Offline'}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-400 tabular-nums">{lastSeen}</td>
      <td className="px-4 py-3 text-sm text-gray-300 hidden md:table-cell">
        {screen.group ?? <span className="text-gray-600 italic">—</span>}
      </td>
      <td className="px-4 py-3 text-sm text-gray-300 hidden lg:table-cell">
        {screen.currentPlaylist ?? <span className="text-gray-600 italic">None</span>}
      </td>
      <td className="px-4 py-3 text-sm text-gray-400 hidden xl:table-cell max-w-[200px]">
        <span className="truncate block" title={screen.currentContent ?? ''}>
          {screen.currentContent ?? <span className="text-gray-600 italic">—</span>}
        </span>
      </td>
    </tr>
  );
}

export function ScreenHealthMonitor() {
  const { data, isLoading, dataUpdatedAt, refetch, isRefetching } =
    trpc.screens.health.useQuery(undefined, {
      refetchInterval: 30_000,
    });

  const onlineCount = data?.filter((s) => isOnline(s.lastHeartbeat)).length ?? 0;
  const total       = data?.length ?? 0;

  const updatedAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-gray-300">
              <span className="text-white font-semibold">{onlineCount}</span>
              <span className="text-gray-500"> / {total} online</span>
            </span>
          </div>
          {total > 0 && onlineCount < total && (
            <span className="text-xs text-yellow-400 font-medium">
              {total - onlineCount} offline
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {updatedAt && (
            <span className="text-xs text-gray-500">Updated {updatedAt}</span>
          )}
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-gray-500 text-sm">Loading…</div>
        ) : !data?.length ? (
          <div className="py-16 text-center text-gray-500 text-sm">No screens registered.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium">Screen</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Last seen</th>
                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Group</th>
                <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Playlist</th>
                <th className="px-4 py-3 text-left font-medium hidden xl:table-cell">Playing now</th>
              </tr>
            </thead>
            <tbody>
              {data.map((screen) => (
                <HealthRow key={screen.id} screen={screen} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-600">Auto-refreshes every 30 seconds. Online = heartbeat within 90s.</p>
    </div>
  );
}
