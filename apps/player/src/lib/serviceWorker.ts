// Registers the Workbox service worker that next-pwa already builds to
// public/sw.js (see next.config.ts) — this registration call was previously
// missing entirely, so the offline caching config it defines was never
// actually installed on any device.

const UPDATE_CHECK_MS = 45 * 60 * 1000; // kiosk tabs never navigate, so the
// browser's normal navigation-triggered update check never fires on its own.

export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('/sw.js').then((registration) => {
    registration.update().catch(() => null);
    setInterval(() => registration.update().catch(() => null), UPDATE_CHECK_MS);
  }).catch((err) => {
    console.warn('[sw] registration failed:', err);
  });

  // skipWaiting + clientsClaim mean a new SW takes control immediately, but
  // the already-running tab keeps executing old JS until reloaded — a kiosk
  // that never navigates would otherwise never pick up a deployed update.
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}

// Lets callers wait for the SW to be actively controlling the page before
// issuing warm-up fetches, so a first-ever pairing boot doesn't race the SW
// install and fall through to an uncached network fetch.
export async function waitForServiceWorkerReady(timeoutMs = 10_000): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('sw ready timeout')), timeoutMs)),
    ]);
    return true;
  } catch {
    return false;
  }
}
