'use client';
import type { EmergencyAlertConfig } from '@signflow/types';

export function EmergencyOverlay({ alert }: { alert: EmergencyAlertConfig | null }) {
  if (!alert?.isActive) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ backgroundColor: alert.backgroundColor, color: alert.textColor }}
    >
      <h1 className="text-6xl font-black mb-6">{alert.title}</h1>
      <p className="text-3xl font-medium max-w-2xl text-center">{alert.message}</p>
    </div>
  );
}
