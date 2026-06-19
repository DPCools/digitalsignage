import type { PlayerConfig, PlaylistConfig, PlaylistItemConfig, Zone } from '@signflow/types';
import { resolveActivePlaylist } from './scheduler';
import { queueImpression, getCachedAsset, cacheAsset } from '@/lib/db';
import { sendImpressions } from '@/lib/api';

export type ZoneState = {
  zone: Zone;
  items: PlaylistItemConfig[];
  currentIndex: number;
  currentItem: PlaylistItemConfig | null;
};

export type EngineState = {
  zones: Record<Zone, ZoneState>;
  activePlaylist: PlaylistConfig | null;
};

export type EngineListener = (state: EngineState) => void;

const ZONES: Zone[] = ['main', 'ticker', 'clock', 'weather'];
const IMPRESSION_FLUSH_MS = 30_000;

export class PlaylistEngine {
  private config: PlayerConfig | null = null;
  private state: EngineState = this.emptyState();
  private listeners: Set<EngineListener> = new Set();
  private timers: Map<Zone, ReturnType<typeof setTimeout>> = new Map();
  private watchdogTimers: Map<Zone, ReturnType<typeof setTimeout>> = new Map();
  private impressionTimer: ReturnType<typeof setInterval> | null = null;
  private itemStartTimes: Map<Zone, number> = new Map();

  private emptyState(): EngineState {
    const zones = {} as Record<Zone, ZoneState>;
    for (const z of ZONES) {
      zones[z] = { zone: z, items: [], currentIndex: 0, currentItem: null };
    }
    return { zones, activePlaylist: null };
  }

  subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const l of this.listeners) l(this.state);
  }

  private setState(update: Partial<EngineState>) {
    this.state = { ...this.state, ...update };
    this.notify();
  }

  load(config: PlayerConfig) {
    this.config = config;
    this.reconcile(new Date());

    // Flush impressions every 30 seconds
    if (this.impressionTimer) clearInterval(this.impressionTimer);
    this.impressionTimer = setInterval(
      () => sendImpressions(config.orgSlug, config.screenId),
      IMPRESSION_FLUSH_MS
    );
  }

  reconcile(now: Date) {
    if (!this.config) return;
    const playlist = resolveActivePlaylist(this.config, now);

    // Same playlist ID isn't enough — items within it may have changed (push update).
    // Compare a fingerprint of item IDs+URLs so content edits trigger a reload.
    if (playlist?.id === this.state.activePlaylist?.id && this.playlistFingerprint(playlist) === this.playlistFingerprint(this.state.activePlaylist)) return;

    this.clearAllTimers();
    const zones = this.buildZoneQueues(playlist);
    this.setState({ activePlaylist: playlist, zones });
    this.startAllZones();
    this.preloadForAllZones();
  }

  private playlistFingerprint(playlist: PlaylistConfig | null): string {
    if (!playlist) return '';
    return playlist.items.map(i => `${i.id}:${i.url}`).join('|');
  }

  private buildZoneQueues(playlist: PlaylistConfig | null): Record<Zone, ZoneState> {
    const queues = this.emptyState().zones;
    if (!playlist) return queues;

    for (const item of playlist.items) {
      const zone = (item.zone as Zone) ?? 'main';
      if (queues[zone]) {
        queues[zone].items.push(item);
      }
    }

    for (const zone of ZONES) {
      queues[zone].currentItem = queues[zone].items[0] ?? null;
    }

    return queues;
  }

  private startAllZones() {
    for (const zone of ZONES) {
      this.scheduleNextTick(zone);
    }
  }

  private scheduleNextTick(zone: Zone) {
    const zoneState = this.state.zones[zone];
    const item = zoneState.currentItem;
    if (!item) return;

    this.itemStartTimes.set(zone, Date.now());
    const duration = item.duration * 1000;

    // VIDEO items: wait for the onVideoEnd callback instead of a fixed timer.
    // Keep a watchdog at 3× declared duration as a failsafe (e.g. if ended never fires).
    if (item.type === 'VIDEO') {
      const watchdog = setTimeout(() => this.tick(zone), Math.max(duration * 3, 30_000));
      this.watchdogTimers.set(zone, watchdog);
      // Normal timer intentionally omitted — ContentPlayer calls tick() via onVideoEnd.
      return;
    }

    // Watchdog: if tick doesn't fire within 2× expected duration, force advance
    const watchdog = setTimeout(() => this.tick(zone), duration * 2);
    this.watchdogTimers.set(zone, watchdog);

    const timer = setTimeout(() => this.tick(zone), duration);
    this.timers.set(zone, timer);
  }

  tick(zone: Zone) {
    const zoneState = this.state.zones[zone];
    const completedItem = zoneState.currentItem;
    const startTime = this.itemStartTimes.get(zone);

    // Record impression
    if (completedItem && startTime) {
      const durationMs = Date.now() - startTime;
      queueImpression({
        contentItemId: completedItem.contentItemId,
        screenId: this.config!.screenId,
        playedAt: new Date().toISOString(),
        durationMs,
      });
    }

    // Advance to next item
    const nextIndex = (zoneState.currentIndex + 1) % Math.max(zoneState.items.length, 1);
    const nextItem = zoneState.items[nextIndex] ?? null;

    const updatedZone: ZoneState = { ...zoneState, currentIndex: nextIndex, currentItem: nextItem };
    const zones = { ...this.state.zones, [zone]: updatedZone };
    this.setState({ zones });

    // Clear timers for this zone
    clearTimeout(this.timers.get(zone));
    clearTimeout(this.watchdogTimers.get(zone));

    // Schedule next
    this.scheduleNextTick(zone);

    // Preload the item after next
    this.preloadNext(zone);

    // Re-check schedule (might need to switch playlist)
    this.reconcile(new Date());
  }

  private async preloadForAllZones() {
    for (const zone of ZONES) {
      await this.preloadNext(zone);
    }
  }

  private async preloadNext(zone: Zone) {
    const zoneState = this.state.zones[zone];
    if (zoneState.items.length < 2) return;
    const nextIndex = (zoneState.currentIndex + 1) % zoneState.items.length;
    const nextItem = zoneState.items[nextIndex];
    if (!nextItem?.url) return;
    // Videos stream from the server — blob-caching them wastes memory and breaks range requests
    if (nextItem.type === 'VIDEO') return;

    const cached = await getCachedAsset(nextItem.url);
    if (cached) return;

    try {
      const res = await fetch(nextItem.url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      await cacheAsset(nextItem.url, blobUrl);
    } catch {
      // Preload failure is non-fatal — will use original URL as fallback
    }
  }

  private clearAllTimers() {
    for (const t of this.timers.values()) clearTimeout(t);
    for (const t of this.watchdogTimers.values()) clearTimeout(t);
    this.timers.clear();
    this.watchdogTimers.clear();
  }

  destroy() {
    this.clearAllTimers();
    if (this.impressionTimer) clearInterval(this.impressionTimer);
    this.listeners.clear();
  }
}
