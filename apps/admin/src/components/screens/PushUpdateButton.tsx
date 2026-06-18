'use client';
import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { RefreshCw, CheckCircle2 } from 'lucide-react';

interface Props {
  screenId: string;
}

export function PushUpdateButton({ screenId }: Props) {
  const [done, setDone] = useState(false);
  const send = trpc.screens.sendCommand.useMutation({
    onSuccess: () => {
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    },
  });

  return (
    <button
      onClick={() => send.mutate({ screenId, command: 'playlist_update' })}
      disabled={send.isPending || done}
      title="Push latest config to this screen now"
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
        done
          ? 'bg-green-800 text-green-300'
          : 'bg-gray-800 hover:bg-blue-700 text-gray-300 hover:text-white'
      }`}
    >
      {done ? (
        <><CheckCircle2 className="h-3.5 w-3.5" /> Pushed</>
      ) : (
        <><RefreshCw className={`h-3.5 w-3.5 ${send.isPending ? 'animate-spin' : ''}`} /> Push Update</>
      )}
    </button>
  );
}
