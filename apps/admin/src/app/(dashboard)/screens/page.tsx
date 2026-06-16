import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { getTenantClient } from '@signflow/db';
import { ScreenCard } from '@/components/screens/ScreenCard';
import { RegisterScreenModal } from '@/components/screens/RegisterScreenModal';

export default async function ScreensPage() {
  const session = await auth();
  if (!session) redirect('/login');
  const db = getTenantClient(session.user.orgSlug);
  const screens = await db.screen.findMany({
    include: { group: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Screens</h1>
        <RegisterScreenModal />
      </div>
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
    </div>
  );
}
