import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';
import { getTenantClient } from '@signflow/db';
import Link from 'next/link';
import { CreatePlaylistButtonClient } from '@/components/playlists/CreatePlaylistButtonClient';
import { DeletePlaylistButton } from '@/components/playlists/DeletePlaylistButton';

export default async function PlaylistsPage() {
  const session = await auth();
  if (!session) redirect('/login');
  const db = getTenantClient(session.user.orgSlug);

  const playlists = await db.playlist.findMany({
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Playlists</h1>
        <CreatePlaylistButtonClient />
      </div>
      {playlists.length === 0 ? (
        <p className="text-center text-gray-500 py-12">
          No playlists yet. Create one to get started.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((pl) => (
            <div key={pl.id} className="relative">
              <Link
                href={`/playlists/${pl.id}`}
                className="block rounded-xl border border-gray-800 bg-gray-900 p-5 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center gap-2 pr-8">
                  <h2 className="font-semibold text-white truncate">{pl.name}</h2>
                  {pl.isDefault && (
                    <span className="shrink-0 text-xs bg-blue-900 text-blue-200 px-2 py-0.5 rounded-full">Default</span>
                  )}
                </div>
                {pl.description && (
                  <p className="mt-1 text-sm text-gray-400 line-clamp-2">{pl.description}</p>
                )}
                <p className="mt-3 text-sm text-gray-500">{pl._count.items} item{pl._count.items !== 1 ? 's' : ''}</p>
              </Link>
              <DeletePlaylistButton id={pl.id} name={pl.name} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
