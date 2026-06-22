import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { auth } from '@/server/auth';
import { getTenantClient } from '@signflow/db';
import { SnapshotViewer } from '@/components/screens/SnapshotViewer';
import { PushUpdateButton } from '@/components/screens/PushUpdateButton';

const ONLINE_MS = 90_000;

function isOnline(d: Date | null) {
  return d ? Date.now() - d.getTime() < ONLINE_MS : false;
}

function timeAgo(d: Date | null): string {
  if (!d) return 'Never';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 10)    return 'just now';
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-800/60 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-200">{value}</span>
    </div>
  );
}

export default async function ScreenDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (!session) redirect('/login');

  const db = getTenantClient(session.user.orgSlug);

  const screen = await db.screen.findUnique({
    where: { id },
    include: {
      group:           { select: { id: true, name: true } },
      currentPlaylist: { select: { id: true, name: true } },
      heartbeats: {
        take: 20,
        orderBy: { timestamp: 'desc' },
        select: { id: true, timestamp: true, playlistId: true, contentId: true },
      },
    },
  });

  if (!screen) notFound();

  const online = isOnline(screen.lastHeartbeat);

  // Resolve content names from the heartbeat contentIds
  const contentIds = [...new Set(screen.heartbeats.map((h) => h.contentId).filter(Boolean))] as string[];
  const contentItems = contentIds.length
    ? await db.contentItem.findMany({
        where: { id: { in: contentIds } },
        select: { id: true, name: true },
      })
    : [];
  const contentMap = Object.fromEntries(contentItems.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + header */}
      <div>
        <Link
          href="/screens"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-3"
        >
          <ChevronLeft className="w-4 h-4" /> Screens
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{screen.name}</h1>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                online
                  ? 'bg-green-500/15 text-green-400'
                  : 'bg-gray-700/60 text-gray-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
          <PushUpdateButton screenId={screen.id} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Snapshot viewer */}
        <div className="lg:col-span-2">
          <SnapshotViewer
            initialUrl={screen.lastSnapshot}
            screenName={screen.name}
          />
        </div>

        {/* Screen info */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Details</h2>
          <InfoRow label="Last seen"    value={timeAgo(screen.lastHeartbeat)} />
          <InfoRow label="Group"        value={screen.group?.name ?? <span className="text-gray-600 italic">None</span>} />
          <InfoRow label="Playlist"     value={screen.currentPlaylist?.name ?? <span className="text-gray-600 italic">None</span>} />
          <InfoRow label="Orientation"  value={screen.orientation.charAt(0) + screen.orientation.slice(1).toLowerCase()} />
          <InfoRow label="Resolution"   value={screen.resolution ?? <span className="text-gray-600 italic">Unknown</span>} />
          <InfoRow label="Pairing code" value={<span className="font-mono">{screen.uniqueCode}</span>} />
        </div>

        {/* Recent heartbeats */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Recent Heartbeats
            </h2>
          </div>
          {screen.heartbeats.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-500 text-sm">No heartbeats recorded.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                  <th className="px-5 py-3 font-medium">Time</th>
                  <th className="px-5 py-3 font-medium">Playing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {screen.heartbeats.map((hb) => (
                  <tr key={hb.id} className="hover:bg-gray-800/20 transition-colors">
                    <td className="px-5 py-2.5 text-gray-400 tabular-nums whitespace-nowrap">
                      {new Date(hb.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-2.5 text-gray-300 truncate max-w-[180px]">
                      {hb.contentId
                        ? (contentMap[hb.contentId] ?? <span className="font-mono text-xs text-gray-500">{hb.contentId.slice(0, 8)}…</span>)
                        : <span className="text-gray-600 italic">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
