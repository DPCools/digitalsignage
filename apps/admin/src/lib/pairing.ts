// Single source of truth for pairing-code expiry — used by both the
// player-facing poll route (apps/admin/src/app/api/player/pair/route.ts)
// and the admin-facing claim mutation (screensRouter.register), so the two
// can't silently drift apart if the TTL/expiry rule ever changes.
export function isPairingCodeExpired(pairing: { expiresAt: Date }): boolean {
  return pairing.expiresAt < new Date();
}
