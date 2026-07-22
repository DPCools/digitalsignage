import type { PlayerConfig, ContentType } from '@signflow/types';
import { CACHEABLE_CACHE_NAMES } from './cacheNames';
import { waitForServiceWorkerReady } from './serviceWorker';

// Only real media assets are cached — RSS/web pages/CCTV stay live, matching
// the existing design (they're either inherently dynamic or already proxied).
const CACHEABLE_TYPES = new Set<ContentType>(['IMAGE', 'VIDEO', 'PDF', 'HTML_TEMPLATE']);

const WARM_CONCURRENCY = 3; // kiosk hardware/LAN links can be modest; avoid saturating them

// Dedupes cacheable URLs across every playlist in the config, not just the
// active one — schedules can rotate playlists intraday, and a reboot while
// offline shouldn't lose content simply because it wasn't the one on screen
// at the moment the network dropped.
export function collectCacheableUrls(config: PlayerConfig): string[] {
  const urls = new Set<string>();
  for (const playlist of config.playlists) {
    for (const item of playlist.items) {
      if (CACHEABLE_TYPES.has(item.type) && item.url) urls.add(item.url);
    }
  }
  return [...urls];
}

// Proactively downloads every cacheable asset in the config so a later
// offline reboot has everything already in Cache Storage, not just whatever
// happened to be one-item-ahead when the network dropped. Uses a plain
// same-context fetch() (not an <img>/<video> element request) so the
// response isn't opaque — the SW's CacheFirst route intercepts it and stores
// a full response that can later be Range-sliced for video. Idempotent:
// CacheFirst short-circuits URLs already cached, so it's safe to call on
// every config load, including recovering a warm interrupted by power loss.
export async function warmPlaylistAssets(config: PlayerConfig): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  const ready = await waitForServiceWorkerReady();
  if (!ready) return;

  const urls = collectCacheableUrls(config);
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const url = urls[i++];
      try {
        await fetch(url, { mode: 'cors' });
      } catch (err) {
        // Non-fatal — most commonly a missing CORS config on the asset origin
        // (video specifically needs this for range-sliced offline playback).
        console.warn('[assetCache] warm failed for', url, err);
      }
    }
  }
  await Promise.allSettled(Array.from({ length: WARM_CONCURRENCY }, worker));
}

// Reference-counted eviction: removes any cached entry no longer referenced
// by the current config, layered on top of Workbox's own maxEntries/maxAge
// caps (next.config.ts) as a belt-and-braces bound on storage growth.
export async function pruneUnreferencedAssets(config: PlayerConfig): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  const referenced = new Set(collectCacheableUrls(config));

  for (const cacheName of CACHEABLE_CACHE_NAMES) {
    try {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      await Promise.all(
        requests
          .filter((req) => !referenced.has(req.url))
          .map((req) => cache.delete(req))
      );
    } catch (err) {
      console.warn('[assetCache] prune failed for', cacheName, err);
    }
  }
}
