'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { setConfig, getConfig } from '@/lib/db';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function PairPage() {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  // Only true once we've confirmed there's no usable existing pairing —
  // prevents flashing a fresh pairing code (and burning a code) for a
  // device that's already validly registered.
  const [checkedExisting, setCheckedExisting] = useState(false);

  const createCode = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/player/pair`, { method: 'POST' });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setCode(data.code);
    } catch {
      setError('Cannot reach server. Retrying…');
      setTimeout(createCode, 5000);
    }
  }, []);

  // On load, check for an existing pairing in IndexedDB. If it's still
  // valid on the server, skip re-pairing entirely and go straight to /play.
  // Only fall through to generating a new code if there's no stored config
  // or the server rejects the stored token (device was actually removed).
  useEffect(() => {
    (async () => {
      const cfg = await getConfig();
      if (!cfg?.token) {
        setCheckedExisting(true);
        return;
      }
      try {
        const res = await fetch(
          `${BASE}/api/player/config?screenId=${encodeURIComponent(cfg.screenId)}&orgSlug=${encodeURIComponent(cfg.orgSlug)}`,
          { headers: { Authorization: `Bearer ${cfg.token}` } }
        );
        if (res.ok) {
          router.replace(`/play/${cfg.screenId}`);
          return;
        }
      } catch {
        // Network error — treat as unverifiable, not invalid. Don't burn a
        // pairing code just because the device briefly lost connectivity.
        setError('Cannot verify existing pairing. Retrying…');
        setTimeout(() => setCheckedExisting(false), 5000);
        return;
      }
      // Server explicitly rejected the token (e.g. screen was deleted) —
      // this device genuinely needs to re-pair.
      setCheckedExisting(true);
    })();
  }, [router]);

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
        } else if (res.status === 404 || res.status === 410) {
          // Code expired or invalid — regenerate
          clearInterval(interval);
          setCode(null);
          setError('Pairing code expired. Generating a new one…');
          createCode();
        }
      } catch { /* ignore transient network errors during polling */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [code, router]);

  useEffect(() => {
    if (checkedExisting) createCode();
  }, [checkedExisting, createCode]);

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
        <div className="text-gray-500 text-sm animate-pulse">
          {checkedExisting ? 'Generating pairing code…' : 'Checking for existing pairing…'}
        </div>
      )}
    </div>
  );
}
