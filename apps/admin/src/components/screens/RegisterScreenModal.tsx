'use client';
import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { Monitor } from 'lucide-react';

export function RegisterScreenModal() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const register = trpc.screens.register.useMutation({
    onSuccess: () => { setOpen(false); setCode(''); setName(''); window.location.reload(); },
  });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
      >
        <Monitor className="h-4 w-4" />
        Register Screen
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
            <h2 className="font-semibold text-white">Register Screen</h2>
            <p className="text-sm text-gray-400">
              Enter the 6-digit code shown on the display.
            </p>
            <input
              placeholder="6-digit code (e.g. ABC123)"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-center text-2xl font-mono tracking-widest"
            />
            <input
              placeholder="Screen name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white"
            />
            {register.error && (
              <p className="text-sm text-red-400">{register.error.message}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-gray-700 py-2 text-sm text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => register.mutate({ code, name })}
                disabled={code.length !== 6 || !name || register.isPending}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {register.isPending ? 'Registering…' : 'Register'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
