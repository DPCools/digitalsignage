'use client';
import { useEffect, useState } from 'react';
import type { EmergencyAlertConfig } from '@signflow/types';

export function EmergencyOverlay({ alert }: { alert: EmergencyAlertConfig | null }) {
  const [flash, setFlash] = useState(true);

  // flashInterval is derived here so it can be used as an effect dependency.
  // undefined severity defaults to EMERGENCY behaviour (600ms) — safe for alerts
  // published before this field was introduced.
  const flashInterval = alert?.severity === 'INFO' ? null
    : alert?.severity === 'WARNING' ? 1200
    : 600; // EMERGENCY / undefined default

  useEffect(() => {
    if (!alert?.isActive) return;
    // Always reset to solid before starting (or not starting) a new interval,
    // so stale flash state from a previous alert can never bleed through.
    setFlash(true);
    if (flashInterval === null) return; // INFO: stay solid, no interval needed
    const t = setInterval(() => setFlash((f) => !f), flashInterval);
    return () => clearInterval(t);
  // Include alert?.id so a replacement alert (same isActive=true) re-triggers.
  }, [alert?.id, alert?.isActive, flashInterval]);

  if (!alert?.isActive) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-10 px-16 text-center"
      style={{
        backgroundColor: flash ? alert.backgroundColor : '#000',
        color: alert.textColor,
        transition: 'background-color 0.15s ease',
      }}
    >
      <p
        style={{
          fontSize: '4vw',
          fontWeight: 900,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          textShadow: '0 4px 32px rgba(0,0,0,0.6)',
          opacity: flash ? 1 : 0.15,
          transition: 'opacity 0.15s ease',
          lineHeight: 1,
        }}
      >
        ⚠ ALERT
      </p>

      <h1
        style={{
          fontSize: '7vw',
          fontWeight: 900,
          lineHeight: 1,
          textShadow: '0 6px 40px rgba(0,0,0,0.5)',
        }}
      >
        {alert.title}
      </h1>

      <p
        style={{
          fontSize: '2.5vw',
          fontWeight: 600,
          lineHeight: 1.3,
          maxWidth: '80vw',
          textShadow: '0 3px 16px rgba(0,0,0,0.5)',
        }}
      >
        {alert.message}
      </p>
    </div>
  );
}
