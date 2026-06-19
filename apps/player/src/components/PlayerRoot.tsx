'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { PlayerConfig, EmergencyAlertConfig } from '@signflow/types';
import { PlaylistEngine, type EngineState, type ZoneState } from '@/engine/PlaylistEngine';
import { ScreenLayout } from './ScreenLayout';
import { EmergencyOverlay } from './EmergencyOverlay';
import { DebugOverlay } from './DebugOverlay';
import { fetchPlayerConfig, sendHeartbeat } from '@/lib/api';
import { getConfig, getPlayerConfig, setPlayerConfig } from '@/lib/db';
import { connectSocket } from '@/lib/socket';

const ZONES_INIT: EngineState['zones'] = {
  main:    { zone: 'main',    items: [], currentIndex: 0, currentItem: null },
  ticker:  { zone: 'ticker',  items: [], currentIndex: 0, currentItem: null },
  clock:   { zone: 'clock',   items: [], currentIndex: 0, currentItem: null },
  weather: { zone: 'weather', items: [], currentIndex: 0, currentItem: null },
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
  }, []);

  useEffect(() => {
    let configPoll: ReturnType<typeof setInterval>;
    let heartbeat: ReturnType<typeof setInterval>;
    // Track current state for the heartbeat closure without needing to access private fields
    let currentState: EngineState = { activePlaylist: null, zones: ZONES_INIT };

    async function init() {
      // Read orgSlug from IndexedDB
      const cfg = await getConfig();
      if (!cfg) return;
      const { orgSlug: slug } = cfg;
      setOrgSlug(slug);

      // Init engine
      const engine = new PlaylistEngine();
      engineRef.current = engine;
      const unsub = engine.subscribe((state) => {
        currentState = state;
        setEngineState(state);
      });

      // Load cached config immediately
      const cached = await getPlayerConfig();
      if (cached) {
        engine.load(cached);
        if (cached.weatherApiKey) setWeatherApiKey(cached.weatherApiKey);
        if (cached.weatherLocation) setWeatherLocation(cached.weatherLocation);
        if (cached.playerStreamToken) setStreamToken(cached.playerStreamToken);
      }

      // Fetch fresh config
      fetchPlayerConfig(screenId, slug).then(loadConfig).catch(() => null);

      // Poll every 5 minutes
      configPoll = setInterval(
        () => fetchPlayerConfig(screenId, slug).then(loadConfig).catch(() => null),
        5 * 60 * 1000
      );

      // Heartbeat every 30 seconds
      heartbeat = setInterval(() => {
        sendHeartbeat(
          screenId,
          slug,
          currentState.activePlaylist?.id,
          currentState.zones.main?.currentItem?.contentItemId
        );
      }, 30_000);

      // Connect Socket.io
      const socket = connectSocket(screenId, slug);
      // playlist:update carries no payload — it's a signal to re-fetch from the server
      socket.on('playlist:update', () =>
        fetchPlayerConfig(screenId, slug).then(loadConfig).catch(() => null)
      );
      socket.on('alert:emergency', setAlert);
      socket.on('alert:clear', () => setAlert(null));
      socket.on('screen:reload', () => window.location.reload());
      socket.on('screen:screenshot', async () => {
        try {
          const { default: html2canvas } = await import('html2canvas');
          const canvas = await html2canvas(document.body);
          const { sendSnapshot } = await import('@/lib/api');
          await sendSnapshot(slug, screenId, canvas.toDataURL('image/png').split(',')[1]);
        } catch { /* non-fatal */ }
      });

      // Keyboard shortcuts
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
        screenId={screenId}
        orgSlug={orgSlug}
        weatherApiKey={weatherApiKey}
        weatherLocation={weatherLocation}
        streamToken={streamToken}
        onVideoEnd={(zone) => engineRef.current?.tick(zone)}
      />
      <DebugOverlay state={engineState} screenId={screenId} orgSlug={orgSlug} visible={debug} />
    </>
  );
}
