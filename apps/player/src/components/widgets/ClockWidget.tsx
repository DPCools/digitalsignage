'use client';
import { useEffect, useState } from 'react';

export function ClockWidget() {
  const [time, setTime] = useState<Date | null>(null);
  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-lg bg-black/60 px-3 py-1.5">
      <span className="text-white text-sm font-mono tabular-nums">
        {time ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
      </span>
    </div>
  );
}
