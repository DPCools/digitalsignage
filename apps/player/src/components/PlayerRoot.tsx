'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { PlayerConfig, EmergencyAlertConfig } from '@signflow/types';
import { PlaylistEngine, type EngineState } from '@/engine/PlaylistEngine';
import { ScreenLayout } from './ScreenLayout';
import { EmergencyOverlay } from './EmergencyOverlay';
import { DebugOverlay } from './DebugOverlay';
import { ConnectivityPill } from './ConnectivityPill';
import { fetchPlayerConfig, sendHeartbeat, checkSnapshotTrigger } from '@/lib/api';
import { getConfig, getPlayerConfig, setPlayerConfig } from '@/lib/db';
import { connectSocket } from '@/lib/socket';
import { registerServiceWorker } from '@/lib/serviceWorker';
import { warmPlaylistAssets, pruneUnreferencedAssets } from '@/lib/assetCache';
import { initConnectivityWatchers, subscribeConnectivity } from '@/lib/connectivity';

const ZONES_INIT: EngineState['zones'] = {
  main:    { zone: 'main',    items: [], currentIndex: 0, currentItem: null, isFixed: false },
  ticker:  { zone: 'ticker',  items: [], currentIndex: 0, currentItem: null, isFixed: false },
  clock:   { zone: 'clock',   items: [], currentIndex: 0, currentItem: null, isFixed: false },
  weather: { zone: 'weather', items: [], currentIndex: 0, currentItem: null, isFixed: false },
};

export function PlayerRoot({ screenId }: { screenId: string }) {
  const engineRef = useRef<PlaylistEngine | null>(null);
  const [engineState, setEngineState] = useState<EngineState>({ activePlaylist: null, zones: ZONES_INIT });
  const [alert, setAlert] = useState<EmergencyAlertConfig | null>(null);
  const [debug, setDebug] = useState(false);
  const [orgSlug, setOrgSlug] = useState('');
  const [weatherApiKey, setWeatherApiKey] = useState<string | undefined>(undefined);
  const [weatherLocation, setWeatherLocation] = useState<string | undefined>(undefined);
  const [streamToken, setStreamToken] = useState<string | undefined>(undefined);

  const loadConfig = useCallback(async (config: PlayerConfig | null) => {
    if (!config) return;
    await setPlayerConfig(config);
    if (config.weatherApiKey) setWeatherApiKey(config.weatherApiKey);
    if (config.weatherLocation) setWeatherLocation(config.weatherLocation);
    if (config.playerStreamToken) setStreamToken(config.playerStreamToken);
    if (!engineRef.current) return;
    engineRef.current.load(config);
    if (config.activeAlert?.isActive) setAlert(config.activeAlert);
    // Fire-and-forget: proactively cache everything this config references so a
    // later offline reboot has it all already, and drop anything no longer used.
    warmPlaylistAssets(config);
    pruneUnreferencedAssets(config);
  }, []);

  useEffect(() => {
    let configPoll:      ReturnType<typeof setInterval>;
    let heartbeat:       ReturnType<typeof setInterval>;
    let snapshotInitTimer: ReturnType<typeof setTimeout>;
    let snapshotTimer:   ReturnType<typeof setInterval>;
    let triggerPoll:     ReturnType<typeof setInterval>;
    let currentState: EngineState = { activePlaylist: null, zones: ZONES_INIT };

    async function init() {
      registerServiceWorker();

      const cfg = await getConfig();
      if (!cfg) return;
      const { orgSlug: slug } = cfg;
      setOrgSlug(slug);

      const engine = new PlaylistEngine();
      engineRef.current = engine;
      const unsub = engine.subscribe((state) => {
        currentState = state;
        setEngineState(state);
      });

      // Load cached config immediately so content shows without waiting for network
      const cached = await getPlayerConfig();
      if (cached) {
        engine.load(cached);
        if (cached.weatherApiKey) setWeatherApiKey(cached.weatherApiKey);
        if (cached.weatherLocation) setWeatherLocation(cached.weatherLocation);
        if (cached.playerStreamToken) setStreamToken(cached.playerStreamToken);
      }

      fetchPlayerConfig(screenId, slug).then(loadConfig).catch(() => null);

      configPoll = setInterval(
        () => fetchPlayerConfig(screenId, slug).then(loadConfig).catch(() => null),
        5 * 60 * 1000
      );

      heartbeat = setInterval(() => {
        sendHeartbeat(
          screenId,
          slug,
          currentState.activePlaylist?.id,
          currentState.zones.main?.currentItem?.contentItemId
        );
      }, 30_000);

      // ----------------------------------------------------------------
      // Snapshot capture
      // ----------------------------------------------------------------
      let isCapturing = false;

      async function takeSnapshot() {
        if (isCapturing) return;
        isCapturing = true;
        console.log('[snapshot] starting capture');
        try {
          const { default: html2canvas } = await import('html2canvas-pro');
          const canvas = await html2canvas(document.body, {
            scale: 0.25,
            useCORS: true,
            allowTaint: false,
            ignoreElements: (el) => {
              if ((el as HTMLElement).dataset?.snapshotIgnore === 'true') return true;
              // Iframes and canvases are skipped; videos are overlaid manually below
              if (el.tagName === 'CANVAS' || el.tagName === 'IFRAME') return true;
              if (el.tagName === 'VIDEO') return true;
              if (el.tagName === 'IMG') {
                const src = el.getAttribute('src') ?? '';
                return src.includes('/api/stream/');
              }
              return false;
            },
          });

          // Overlay the current video frame — but ONLY for videos that have the
          // crossOrigin attribute set.  Drawing a non-CORS video taints the canvas
          // and causes toDataURL to throw, silently killing the snapshot upload.
          const ctx = canvas.getContext('2d');
          if (ctx) {
            document.querySelectorAll('video').forEach((video) => {
              if (video.readyState < 2 || !video.crossOrigin) return;
              try {
                const r = video.getBoundingClientRect();
                ctx.drawImage(video, r.left * 0.25, r.top * 0.25, r.width * 0.25, r.height * 0.25);
              } catch { /* ignore */ }
            });
          }

          let dataUrl: string;
          try {
            dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          } catch (err) {
            console.warn('[snapshot] toDataURL failed (canvas tainted):', err);
            return;
          }

          const b64 = dataUrl.split(',')[1];
          console.log('[snapshot] uploading', b64.length, 'B');
          const { sendSnapshot } = await import('@/lib/api');
          await sendSnapshot(slug, screenId, b64);
          console.log('[snapshot] done');
        } catch (err) {
          console.error('[snapshot] failed:', err);
        } finally {
          isCapturing = false;
        }
      }

      // Poll every 5 s for a pending screenshot trigger set by the admin.
      // This is the primary reliable mechanism — no socket timing dependency.
      triggerPoll = setInterval(async () => {
        try {
          const pending = await checkSnapshotTrigger(screenId, slug);
          if (pending) takeSnapshot();
        } catch { /* ignore network errors */ }
      }, 5_000);

      // Auto-capture 15 s after startup and every 5 min so the admin view
      // always has a recent snapshot without a manual trigger.
      snapshotInitTimer = setTimeout(takeSnapshot, 15_000);
      snapshotTimer     = setInterval(takeSnapshot, 5 * 60 * 1000);

      // Connectivity — "repair" sequence: when the player was unreachable and
      // becomes reachable again, re-fetch the latest config (in case anything
      // changed while offline) rather than silently keep running on whatever
      // was cached. Socket rejoin is already automatic (onConnect below fires
      // on every reconnect, not just the first).
      const stopConnectivityWatchers = initConnectivityWatchers();
      const unsubscribeConnectivity = subscribeConnectivity((reachable) => {
        if (reachable) fetchPlayerConfig(screenId, slug).then(loadConfig).catch(() => null);
      });

      // Socket — fast-path: immediate capture when admin is watching and
      // the player is already connected. Reliable path is the triggerPoll above.
      const socket = connectSocket(screenId, slug);
      const handlePlaylistUpdate = () =>
        fetchPlayerConfig(screenId, slug).then(loadConfig).catch(() => null);
      const handleAlertClear = () => setAlert(null);
      const handleReload     = () => window.location.reload();

      socket.on('playlist:update',  handlePlaylistUpdate);
      socket.on('alert:emergency',  setAlert);
      socket.on('alert:clear',      handleAlertClear);
      socket.on('screen:reload',    handleReload);
      socket.on('screen:screenshot', takeSnapshot);

      const keyHandler = (e: KeyboardEvent) => {
        if (e.key === 'F11') { e.preventDefault(); document.documentElement.requestFullscreen?.(); }
        if (e.key === 'r') window.location.reload();
        if (e.key === 'd') setDebug((v) => !v);
      };
      window.addEventListener('keydown', keyHandler);

      return () => {
        unsub();
        engine.destroy();
        clearInterval(configPoll);
        clearInterval(heartbeat);
        clearInterval(triggerPoll);
        clearTimeout(snapshotInitTimer);
        clearInterval(snapshotTimer);
        stopConnectivityWatchers();
        unsubscribeConnectivity();
        socket.off('playlist:update',  handlePlaylistUpdate);
        socket.off('alert:emergency',  setAlert);
        socket.off('alert:clear',      handleAlertClear);
        socket.off('screen:reload',    handleReload);
        socket.off('screen:screenshot', takeSnapshot);
        socket.disconnect();
        window.removeEventListener('keydown', keyHandler);
      };
    }

    const cleanup = init();
    return () => { cleanup.then((fn) => fn?.()); };
  }, [screenId, loadConfig]);

  return (
    <>
      <EmergencyOverlay alert={alert} />
      <ScreenLayout
        zones={engineState.zones}
        layoutPreset={engineState.activePlaylist?.layoutPreset}
        screenId={screenId}
        orgSlug={orgSlug}
        weatherApiKey={weatherApiKey}
        weatherLocation={weatherLocation}
        streamToken={streamToken}
        onVideoEnd={(zone) => engineRef.current?.tick(zone)}
      />
      <DebugOverlay state={engineState} screenId={screenId} orgSlug={orgSlug} visible={debug} />
      <ConnectivityPill />
    </>
  );
}
