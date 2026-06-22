'use client';
import { useState } from 'react';
import { Monitor } from 'lucide-react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc-client';
import { useRouter } from 'next/navigation';
import { PushUpdateButton } from './PushUpdateButton';

interface Props {
  screen: {
    id: string;
    name: string;
    isOnline: boolean;
    lastHeartbeat: Date | null;
    lastSnapshot: string | null;
    group: { id: string; name: string } | null;
    orientation: string;
  };
}

export function ScreenCard({ screen }: Props) {
  const router = useRouter();
  const [editingGroup, setEditingGroup] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(screen.group?.id ?? '');
  const { data: groups } = trpc.screenGroups.list.useQuery(undefined, { enabled: editingGroup });
  const update = trpc.screens.update.useMutation({
    onSuccess: () => { setEditingGroup(false); router.refresh(); },
  });

  function formatLastSeen(date: Date): string {
    const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    if (diffSec < 30) return 'just now';
    if (diffSec < 3600) return rtf.format(-Math.round(diffSec / 60), 'minute');
    return rtf.format(-Math.round(diffSec / 3600), 'hour');
  }
  const lastSeen = screen.lastHeartbeat ? formatLastSeen(screen.lastHeartbeat) : 'Never';
  const snapshotV = screen.lastSnapshot?.match(/[?&]v=(\d+)/)?.[1] ?? null;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden hover:border-gray-600 transition-colors">
      <Link href={`/screens/${screen.id}` as any}>
        <div className="aspect-video bg-gray-800 relative overflow-hidden group">
          {screen.lastSnapshot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/admin/snapshot?screenId=${screen.id}${snapshotV ? `&v=${snapshotV}` : ''}`}
              alt="Screen snapshot"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Monitor className="h-12 w-12 text-gray-600" />
            </div>
          )}
          <span
            className={`absolute top-2 right-2 h-2.5 w-2.5 rounded-full ${
              screen.isOnline ? 'bg-green-500' : 'bg-gray-600'
            }`}
          />
        </div>
      </Link>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-sm text-white truncate">{screen.name}</p>
          <PushUpdateButton screenId={screen.id} />
        </div>
        {editingGroup ? (
          <div className="flex gap-1.5">
            <select
              autoFocus
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="flex-1 rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-white"
            >
              <option value="">No group</option>
              {groups?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button
              onClick={() => update.mutate({ id: screen.id, groupId: selectedGroupId || null })}
              disabled={update.isPending}
              className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {update.isPending ? '…' : 'Save'}
            </button>
            <button onClick={() => setEditingGroup(false)} className="text-xs text-gray-400 hover:text-white px-1">✕</button>
          </div>
        ) : (
          <button
            onClick={() => setEditingGroup(true)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors text-left w-full"
            title="Click to assign group"
          >
            {screen.group?.name ?? 'No group'} · {lastSeen}
          </button>
        )}
      </div>
    </div>
  );
}
