'use client';
import { useEffect, useState } from 'react';
import { getConnectivityState, subscribeConnectivity } from '@/lib/connectivity';

export function ConnectivityPill() {
  const [reachable, setReachable] = useState(true);

  useEffect(() => {
    setReachable(getConnectivityState());
    return subscribeConnectivity(setReachable);
  }, []);

  if (reachable) return null;

  return (
    <div className="fixed top-4 right-4 z-[9997] flex items-center gap-1.5 rounded-full bg-black/80 px-3 py-1.5 text-xs font-medium text-amber-300">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      Server unreachable — playing cached content
    </div>
  );
}
