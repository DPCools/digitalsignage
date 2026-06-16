'use client';
import type { Zone } from '@signflow/types';
import type { ZoneState } from '@/engine/PlaylistEngine';
import { ZoneRenderer } from './ZoneRenderer';
import { ZoneErrorBoundary } from './ZoneErrorBoundary';

const ZONES: Zone[] = ['main', 'ticker', 'clock', 'weather'];

interface Props {
  zones: Record<Zone, ZoneState>;
  screenId: string;
  orgSlug: string;
  weatherApiKey?: string;
  weatherLocation?: string;
}

export function ScreenLayout({ zones, screenId, orgSlug, weatherApiKey, weatherLocation }: Props) {
  const hasWeather = zones.weather.items.length > 0 || !!weatherApiKey;
  const hasTicker = zones.ticker.items.length > 0;

  return (
    <div
      className="w-screen h-screen overflow-hidden bg-black"
      style={{
        display: 'grid',
        gridTemplateRows: hasTicker ? `1fr 3rem` : '1fr',
        gridTemplateColumns: hasWeather ? '1fr auto' : '1fr',
      }}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <ZoneErrorBoundary zone="main" screenId={screenId} orgSlug={orgSlug}>
          <ZoneRenderer zone="main" state={zones.main} />
        </ZoneErrorBoundary>
      </div>

      {hasTicker && (
        <div style={{ gridColumn: '1 / -1' }} className="bg-black/80">
          <ZoneErrorBoundary zone="ticker" screenId={screenId} orgSlug={orgSlug}>
            <ZoneRenderer zone="ticker" state={zones.ticker} />
          </ZoneErrorBoundary>
        </div>
      )}

      {hasWeather && (
        <ZoneErrorBoundary zone="weather" screenId={screenId} orgSlug={orgSlug}>
          <ZoneRenderer
            zone="weather"
            state={zones.weather}
            weatherApiKey={weatherApiKey}
            weatherLocation={weatherLocation}
          />
        </ZoneErrorBoundary>
      )}

      <ZoneErrorBoundary zone="clock" screenId={screenId} orgSlug={orgSlug}>
        <ZoneRenderer zone="clock" state={zones.clock} />
      </ZoneErrorBoundary>
    </div>
  );
}
