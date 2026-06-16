import { redirect } from 'next/navigation';
import { PlayerRoot } from '@/components/PlayerRoot';

export default async function PlayPage({
  params,
}: {
  params: Promise<{ screenId: string }>;
}) {
  const { screenId } = await params;
  if (!screenId) redirect('/pair');
  return <PlayerRoot screenId={screenId} />;
}
