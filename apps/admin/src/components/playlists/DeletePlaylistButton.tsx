'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { Trash2, Loader2 } from 'lucide-react';

export function DeletePlaylistButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  const del = trpc.playlists.delete.useMutation({
    onSuccess: () => {
      setConfirming(false);
      router.refresh();
    },
  });

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setConfirming(true);
        }}
        aria-label={`Delete playlist ${name}`}
        className="absolute top-3 right-3 rounded-lg p-1.5 text-gray-600 hover:text-red-400 hover:bg-gray-800 transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!del.isPending) setConfirming(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-gray-700 bg-gray-900 p-6 space-y-4"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <h2 className="text-lg font-semibold text-white">Delete playlist?</h2>
            <p className="text-sm text-gray-400">
              This will permanently delete <span className="font-medium text-white">{name}</span> and all of its items. This can&rsquo;t be undone.
            </p>
            {del.error && <p className="text-sm text-red-400">{del.error.message}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={del.isPending}
                className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => del.mutate({ id })}
                disabled={del.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
              >
                {del.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {del.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
