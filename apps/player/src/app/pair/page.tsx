'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { setConfig } from '@/lib/db';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function PairPage() {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState('');

  const createCode = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/player/pair`, { method: 'POST' });
      const data = await res.json();
      setCode(data.code);
    } catch {
      setError('Cannot reach server. Retrying…');
      setTimeout(createCode, 5000);
    }
  }, []);

  // Poll for registration
  useEffect(() => {
    if (!code) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BASE}/api/player/pair?code=${code}`);
        if (res.status === 202) return; // still pending
        if (res.ok) {
          const data = await res.json();
          await setConfig({ screenId: data.screenId, orgSlug: data.orgSlug, token: data.token });
          clearInterval(interval);
          router.replace(`/play/${data.screenId}`);
        }
      } catch { /* ignore network errors during polling */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [code, router]);

  useEffect(() => { createCode(); }, [createCode]);

  // Keyboard shortcut: F11 fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        document.documentElement.requestFullscreen?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-950 text-white gap-8">
      <h1 className="text-3xl font-bold">SignFlow</h1>
      <p className="text-gray-400">Register this display in the admin dashboard</p>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {code ? (
        <div className="text-center space-y-4">
          <p className="text-gray-400 text-sm">Enter this code in the admin dashboard:</p>
          <div className="text-7xl font-mono font-bold tracking-widest bg-gray-900 border border-gray-700 rounded-2xl px-10 py-6">
            {code}
          </div>
          <p className="text-gray-500 text-sm animate-pulse">Waiting for registration…</p>
        </div>
      ) : (
        <div className="text-gray-500 text-sm animate-pulse">Generating pairing code…</div>
      )}
    </div>
  );
}
