// Client-derived "can we reach the server" state. There's no server-pushed
// signal for this (the admin computes a screen's online/offline status from
// heartbeat age, but never pushes that back to the player) — so this is
// built entirely from the player's own observations: navigator.onLine,
// socket connect/disconnect, and explicit success/failure reports from HTTP
// calls in api.ts.

type Listener = (reachable: boolean) => void;

let reachable = true;
const listeners = new Set<Listener>();

// Require 2 consecutive HTTP failures before flipping to unreachable, so a
// single transient timeout doesn't flap the pill on and off.
let consecutiveHttpFailures = 0;
const FAILURE_THRESHOLD = 2;

function setReachable(next: boolean) {
  if (next === reachable) return;
  reachable = next;
  for (const l of listeners) l(reachable);
}

export function getConnectivityState(): boolean {
  return reachable;
}

export function subscribeConnectivity(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function reportHttpSuccess(): void {
  consecutiveHttpFailures = 0;
  setReachable(true);
}

export function reportHttpFailure(): void {
  consecutiveHttpFailures += 1;
  if (consecutiveHttpFailures >= FAILURE_THRESHOLD) setReachable(false);
}

export function reportSocketConnected(): void {
  setReachable(true);
}

export function reportSocketDisconnected(): void {
  // A dropped socket alone isn't definitive (it reconnects on its own) —
  // wait for the next HTTP failure/success to actually decide, except when
  // the browser itself already knows it's offline.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) setReachable(false);
}

export function initConnectivityWatchers(): () => void {
  if (typeof window === 'undefined') return () => {};

  const onOnline = () => setReachable(true);
  const onOffline = () => setReachable(false);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  if (navigator.onLine === false) setReachable(false);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
