'use client';
import { useEffect, useState } from 'react';
import type { EmergencyAlertConfig } from '@signflow/types';

export function EmergencyOverlay({ alert }: { alert: EmergencyAlertConfig | null }) {
  const [flash, setFlash] = useState(true);

  const flashInterval = alert?.severity === 'INFO' ? null
    : alert?.severity === 'WARNING' ? 1200
    : 600;

  useEffect(() => {
    if (!alert?.isActive) return;
    setFlash(true);
    if (flashInterval === null) return;
    const t = setInterval(() => setFlash((f) => !f), flashInterval);
    return () => clearInterval(t);
  }, [alert?.id, alert?.isActive, flashInterval]);

  useEffect(() => {
    if (!alert?.isActive || !alert.soundUrl) return;

    const soundUrl    = alert.soundUrl;
    const maxPlays    = alert.soundRepeat ?? 30;
    const maxBlockedRetries = 5;
    let stopped       = false;
    let playCount     = 0;
    let blockedRetries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const audio       = new Audio(soundUrl);

    function play() {
      if (stopped) return;
      audio.currentTime = 0;
      audio.play()
        .then(() => { console.log('[alert] audio playing'); })
        .catch((err) => {
          blockedRetries++;
          if (blockedRetries > maxBlockedRetries) {
            console.warn(
              '[alert] audio blocked by browser autoplay policy — giving up after',
              maxBlockedRetries, 'attempts. This screen needs autoplay enabled ' +
              '(e.g. Chrome --autoplay-policy=no-user-gesture-required, or the ' +
              'kiosk browser\'s autoplay setting). Visual alert still works.'
            );
            return;
          }
          console.warn('[alert] audio blocked:', err.message, '— retrying in 1s');
          retryTimer = setTimeout(play, 1000);
        });
    }

    audio.onended = () => {
      if (stopped) return;
      playCount++;
      if (playCount < maxPlays) play();
    };

    console.log('[alert] soundUrl:', soundUrl, 'repeat:', maxPlays);
    play();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      audio.pause();
    };
  }, [alert?.id, alert?.isActive, alert?.soundUrl, alert?.soundRepeat]);

  if (!alert?.isActive) return null;

  return (
    <div
      data-snapshot-ignore="true"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-10 px-16 text-center"
      style={{
        backgroundColor: flash ? alert.backgroundColor : '#000',
        color: alert.textColor,
        transition: 'background-color 0.15s ease',
      }}
    >
      <p style={{
        fontSize: '4vw', fontWeight: 900, letterSpacing: '0.2em',
        textTransform: 'uppercase', textShadow: '0 4px 32px rgba(0,0,0,0.6)',
        opacity: flash ? 1 : 0.15, transition: 'opacity 0.15s ease', lineHeight: 1,
      }}>
        ⚠ ALERT
      </p>

      <h1 style={{
        fontSize: '7vw', fontWeight: 900, lineHeight: 1,
        textShadow: '0 6px 40px rgba(0,0,0,0.5)',
      }}>
        {alert.title}
      </h1>

      <p style={{
        fontSize: '2.5vw', fontWeight: 600, lineHeight: 1.3,
        maxWidth: '80vw', textShadow: '0 3px 16px rgba(0,0,0,0.5)',
      }}>
        {alert.message}
      </p>
    </div>
  );
}
