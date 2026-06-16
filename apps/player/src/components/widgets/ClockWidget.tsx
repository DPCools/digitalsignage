'use client';
import { useEffect, useState } from 'react';

export function ClockWidget() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center justify-center h-full text-white text-xl font-mono">
      {time}
    </div>
  );
}
