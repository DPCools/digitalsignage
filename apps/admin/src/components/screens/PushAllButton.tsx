'use client';
import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { RefreshCw, CheckCircle2 } from 'lucide-react';

interface Props {
  screenIds: string[];
}

export function PushAllButton({ screenIds }: Props) {
  const [remaining, setRemaining] = useState(0);
  const [done, setDone] = useState(false);
  const send = trpc.screens.sendCommand.useMutation();

  async function pushAll() {
    if (!screenIds.length) return;
    setDone(false);
    setRemaining(screenIds.length);
    for (const screenId of screenIds) {
      await send.mutateAsync({ screenId, command: 'playlist_update' });
      setRemaining((r) => r - 1);
    }
    setDone(true);
    setTimeout(() => setDone(false), 4000);
  }

  const busy = remaining > 0;

  return (
    <button
      onClick={pushAll}
      disabled={busy || done || screenIds.length === 0}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
        done
          ? 'bg-green-700 text-white'
          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
      }`}
    >
      {done ? (
        <><CheckCircle2 className="h-4 w-4" /> All screens updated</>
      ) : busy ? (
        <><RefreshCw className="h-4 w-4 animate-spin" /> Pushing {remaining} left…</>
      ) : (
        <><RefreshCw className="h-4 w-4" /> Push to All Screens</>
      )}
    </button>
  );
}
