import { auth } from '@/server/auth';
import { getTenantClient } from '@signflow/db';
import { PlaylistBuilder } from '@/components/playlists/PlaylistBuilder';
import { notFound } from 'next/navigation';

export default async function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const db = getTenantClient(session!.user.orgSlug);

  const [playlist, allContent] = await Promise.all([
    db.playlist.findUnique({
      where: { id },
      include: { items: { include: { contentItem: true }, orderBy: { position: 'asc' } } },
    }),
    db.contentItem.findMany({
      where: { status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  if (!playlist) notFound();

  return <PlaylistBuilder playlist={playlist} allContent={allContent} />;
}
