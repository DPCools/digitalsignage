import type { PlayerConfig, PlaylistConfig, PlaylistItemConfig, Zone } from '@signflow/types';
import { getGridPreset, LEGACY_ZONE_IDS } from '@signflow/types';
import { resolveActivePlaylist } from './scheduler';
import { queueImpression, getCachedAsset, cacheAsset } from '@/lib/db';
import { sendImpressions } from '@/lib/api';

export type ZoneState = {
  zone: Zone;
  items: PlaylistItemConfig[];
  currentIndex: number;
  currentItem: PlaylistItemConfig | null;
  isFixed: boolean;
};

export type EngineState = {
  zones: Record<Zone, ZoneState>;
  activePlaylist: PlaylistConfig | null;
};

export type EngineListener = (state: EngineState) => void;

const IMPRESSION_FLUSH_MS = 30_000;

export class PlaylistEngine {
  private config: PlayerConfig | null = null;
  private state: EngineState = this.emptyState(LEGACY_ZONE_IDS);
  private listeners: Set<EngineListener> = new Set();
  private timers: Map<Zone, ReturnType<typeof setTimeout>> = new Map();
  private watchdogTimers: Map<Zone, ReturnType<typeof setTimeout>> = new Map();
  private impressionTimer: ReturnType<typeof setInterval> | null = null;
  private itemStartTimes: Map<Zone, number> = new Map();

  // Resolves which zone/cell ids are active for a playlist: its grid preset's
  // cells if it has one, otherwise the legacy main/ticker/clock/weather set.
  private resolveZoneIds(playlist: PlaylistConfig | null): readonly string[] {
    const preset = getGridPreset(playlist?.layoutPreset);
    return preset ? preset.cells.map((c) => c.id) : LEGACY_ZONE_IDS;
  }

  // A cell is FIXED if the playlist's cellModes says so, else the preset's
  // own default for that cell, else DYNAMIC. Legacy (no preset) zones are
  // always DYNAMIC — unchanged from today's behavior.
  private resolveIsFixed(playlist: PlaylistConfig | null, zone: string): boolean {
    if (!playlist?.layoutPreset) return false;
    const preset = getGridPreset(playlist.layoutPreset);
    const mode = playlist.cellModes?.[zone] ?? preset?.cells.find((c) => c.id === zone)?.defaultMode ?? 'DYNAMIC';
    return mode === 'FIXED';
  }

  private emptyState(zoneIds: readonly string[]): EngineState {
    const zones = {} as Record<Zone, ZoneState>;
    for (const z of zoneIds) {
      zones[z] = { zone: z, items: [], currentIndex: 0, currentItem: null, isFixed: false };
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
    // Must cover every field that changes how/where content renders — not just
    // id+url — or a push update that only reassigns zones or switches the grid
    // preset (same items, same urls) gets silently skipped below.
    const items = playlist.items.map(i => `${i.id}:${i.url}:${i.zone}:${i.duration}:${i.transition}`).join('|');
    const cellModes = JSON.stringify(playlist.cellModes ?? {});
    return `${playlist.layoutPreset ?? ''}::${cellModes}::${items}`;
  }

  private buildZoneQueues(playlist: PlaylistConfig | null): Record<Zone, ZoneState> {
    const zoneIds = this.resolveZoneIds(playlist);
    const queues = this.emptyState(zoneIds).zones;
    if (!playlist) return queues;

    for (const item of playlist.items) {
      const zone = item.zone ?? 'main';
      if (queues[zone]) {
        queues[zone].items.push(item);
      }
    }

    for (const zone of zoneIds) {
      queues[zone].currentItem = queues[zone].items[0] ?? null;
      queues[zone].isFixed = this.resolveIsFixed(playlist, zone);
    }

    return queues;
  }

  private startAllZones() {
    for (const zone of Object.keys(this.state.zones)) {
      this.scheduleNextTick(zone);
    }
  }

  private scheduleNextTick(zone: Zone) {
    const zoneState = this.state.zones[zone];
    // Fixed cells hold exactly one item and never rotate — no timer at all.
    if (zoneState.isFixed) return;

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
    // Defensive guard: a fixed cell holding a looping VIDEO could still have
    // onVideoEnd invoke tick() directly — never advance a fixed cell's index.
    if (!zoneState || zoneState.isFixed) return;

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
    for (const zone of Object.keys(this.state.zones)) {
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
