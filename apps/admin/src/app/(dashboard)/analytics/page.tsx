import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { getTenantClient } from '@signflow/db';

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session) redirect('/login');
  const db = getTenantClient(session.user.orgSlug);
  const since = new Date(Date.now() - 30 * 86400000);

  const [totalImpressions, topContent] = await Promise.all([
    db.impression.count({ where: { playedAt: { gte: since } } }),
    db.impression.groupBy({
      by: ['contentItemId'],
      _count: { contentItemId: true },
      _sum: { durationMs: true },
      where: { playedAt: { gte: since } },
      orderBy: { _count: { contentItemId: 'desc' } },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <p className="text-sm text-gray-400">Total impressions (30d)</p>
          <p className="text-3xl font-bold text-white mt-1">{totalImpressions.toLocaleString()}</p>
        </div>
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Top Content (30d)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-800">
              <th className="pb-2">Content ID</th>
              <th className="pb-2">Plays</th>
              <th className="pb-2">Total time</th>
            </tr>
          </thead>
          <tbody>
            {topContent.map((row) => (
              <tr key={row.contentItemId} className="border-b border-gray-800/50">
                <td className="py-2 text-white font-mono text-xs truncate max-w-[200px]">{row.contentItemId}</td>
                <td className="py-2 text-white">{row._count.contentItemId}</td>
                <td className="py-2 text-gray-400">{Math.round((row._sum.durationMs ?? 0) / 1000)}s</td>
              </tr>
            ))}
            {topContent.length === 0 && (
              <tr><td colSpan={3} className="py-8 text-center text-gray-500">No data yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
