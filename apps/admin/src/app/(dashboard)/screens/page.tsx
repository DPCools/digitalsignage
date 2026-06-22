import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { getTenantClient } from '@signflow/db';
import { ScreenCard } from '@/components/screens/ScreenCard';
import { RegisterScreenModal } from '@/components/screens/RegisterScreenModal';
import { PushAllButton } from '@/components/screens/PushAllButton';
import { ScreenHealthMonitor } from '@/components/screens/ScreenHealthMonitor';

export default async function ScreensPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await auth();
  if (!session) redirect('/login');

  const { view } = await searchParams;
  const isMonitor = view === 'monitor';

  const db = getTenantClient(session.user.orgSlug);
  const screens = isMonitor
    ? []
    : await db.screen.findMany({
        include: { group: true },
        orderBy: { createdAt: 'desc' },
      });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Screens</h1>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-700 overflow-hidden text-sm">
            <Link
              href="/screens"
              className={`px-3 py-1.5 transition-colors ${
                !isMonitor
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              Cards
            </Link>
            <Link
              href={'/screens?view=monitor' as any}
              className={`px-3 py-1.5 transition-colors ${
                isMonitor
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              Health
            </Link>
          </div>

          {!isMonitor && (
            <>
              <PushAllButton screenIds={screens.map((s) => s.id)} />
              <RegisterScreenModal />
            </>
          )}
        </div>
      </div>

      {isMonitor ? (
        <ScreenHealthMonitor />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {screens.map((screen) => (
            <ScreenCard key={screen.id} screen={screen} />
          ))}
          {screens.length === 0 && (
            <p className="col-span-full text-center text-gray-500 py-12">
              No screens registered yet. Click &ldquo;Register Screen&rdquo; to add one.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
