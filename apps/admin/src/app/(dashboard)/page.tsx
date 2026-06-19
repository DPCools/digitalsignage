import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { getTenantClient } from '@signflow/db';

// A screen is considered online if it sent a heartbeat within the last 90 seconds.
const ONLINE_THRESHOLD_MS = 90_000;

function isOnline(lastHeartbeat: Date | null): boolean {
  if (!lastHeartbeat) return false;
  return Date.now() - lastHeartbeat.getTime() < ONLINE_THRESHOLD_MS;
}

function timeAgo(date: Date | null): string {
  if (!date) return 'Never';
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const db = getTenantClient(session.user.orgSlug);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [screens, todayImpressions, activeAlerts] = await Promise.all([
    db.screen.findMany({
      select: {
        id: true,
        name: true,
        lastHeartbeat: true,
        currentPlaylist: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    }),
    db.impression.count({ where: { playedAt: { gte: todayStart } } }),
    db.emergencyAlert.count({ where: { isActive: true } }),
  ]);

  const onlineCount = screens.filter((s) => isOnline(s.lastHeartbeat)).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">
          {session.user.name ?? session.user.email} &middot; {session.user.orgSlug}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Screens online"
          value={`${onlineCount} / ${screens.length}`}
          accent={onlineCount === screens.length ? 'green' : onlineCount === 0 ? 'red' : 'yellow'}
          href="/screens"
        />
        <StatCard
          label="Impressions today"
          value={todayImpressions.toLocaleString()}
          accent="blue"
          href="/analytics"
        />
        <StatCard
          label="Active alerts"
          value={String(activeAlerts)}
          accent={activeAlerts > 0 ? 'red' : 'gray'}
          href="/alerts"
        />
        <StatCard
          label="Total screens"
          value={String(screens.length)}
          accent="gray"
          href="/screens"
        />
      </div>

      {/* Screen status table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Screen Status
          </h2>
          <Link
            href="/screens"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Manage screens →
          </Link>
        </div>

        {screens.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-gray-500 text-sm">No screens registered yet.</p>
            <Link
              href="/screens"
              className="inline-block mt-3 text-sm text-blue-400 hover:text-blue-300"
            >
              Add your first screen →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-5 py-3 font-medium">Screen</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium hidden sm:table-cell">Last seen</th>
                <th className="px-5 py-3 font-medium hidden md:table-cell">Playing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {screens.map((screen) => {
                const online = isOnline(screen.lastHeartbeat);
                return (
                  <tr key={screen.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3">
                      <Link
                        href={`/screens/${screen.id}` as any}
                        className="font-medium text-white hover:text-blue-400 transition-colors"
                      >
                        {screen.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                          online
                            ? 'bg-green-500/15 text-green-400'
                            : 'bg-gray-700/50 text-gray-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            online ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
                          }`}
                        />
                        {online ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 hidden sm:table-cell">
                      {timeAgo(screen.lastHeartbeat)}
                    </td>
                    <td className="px-5 py-3 text-gray-400 hidden md:table-cell">
                      {screen.currentPlaylist?.name ?? (
                        <span className="text-gray-600 italic">No playlist</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickAction href="/content" label="Upload content" />
          <QuickAction href="/playlists" label="Edit playlists" />
          <QuickAction href="/schedules" label="Set schedule" />
          <QuickAction href="/alerts" label="Send alert" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type Accent = 'green' | 'red' | 'yellow' | 'blue' | 'gray';

const ACCENT_CLASSES: Record<Accent, string> = {
  green:  'text-green-400',
  red:    'text-red-400',
  yellow: 'text-yellow-400',
  blue:   'text-blue-400',
  gray:   'text-white',
};

function StatCard({
  label,
  value,
  accent,
  href,
}: {
  label: string;
  value: string;
  accent: Accent;
  href: string;
}) {
  return (
    <Link
      href={href as any}
      className="block rounded-xl border border-gray-800 bg-gray-900 p-5 hover:border-gray-700 transition-colors"
    >
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${ACCENT_CLASSES[accent]}`}>{value}</p>
    </Link>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href as any}
      className="flex items-center justify-center rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-sm text-gray-300 hover:text-white hover:border-gray-700 hover:bg-gray-800 transition-colors"
    >
      {label}
    </Link>
  );
}
