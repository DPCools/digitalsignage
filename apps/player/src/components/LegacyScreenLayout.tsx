'use client';
import type { Zone } from '@signflow/types';
import type { ZoneState } from '@/engine/PlaylistEngine';
import { ZoneRenderer } from './ZoneRenderer';
import { ZoneErrorBoundary } from './ZoneErrorBoundary';

export interface ScreenLayoutProps {
  zones: Record<Zone, ZoneState>;
  screenId: string;
  orgSlug: string;
  weatherApiKey?: string;
  weatherLocation?: string;
  streamToken?: string;
  onVideoEnd: (zone: Zone) => void;
}

// Today's fixed 4-zone layout (main fullscreen + ticker/clock/weather overlays).
// Kept verbatim as the fallback for playlists with no grid layoutPreset set.
export function LegacyScreenLayout({ zones, screenId, orgSlug, weatherApiKey, weatherLocation, streamToken, onVideoEnd }: ScreenLayoutProps) {
  const hasWeather = zones.weather.items.length > 0 || !!weatherApiKey;
  const hasTicker = zones.ticker.items.length > 0;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">

      {/* Main zone — fills the entire screen */}
      <div className="absolute inset-0">
        <ZoneErrorBoundary zone="main" screenId={screenId} orgSlug={orgSlug}>
          <ZoneRenderer zone="main" state={zones.main} screenId={screenId} orgSlug={orgSlug} streamToken={streamToken} onVideoEnd={() => onVideoEnd('main')} />
        </ZoneErrorBoundary>
      </div>

      {/* Ticker — fixed bar at the bottom */}
      {hasTicker && (
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-black/80 z-10">
          <ZoneErrorBoundary zone="ticker" screenId={screenId} orgSlug={orgSlug}>
            <ZoneRenderer zone="ticker" state={zones.ticker} />
          </ZoneErrorBoundary>
        </div>
      )}

      {/* Weather — top-right overlay */}
      {hasWeather && (
        <div className="absolute top-4 right-4 z-10">
          <ZoneErrorBoundary zone="weather" screenId={screenId} orgSlug={orgSlug}>
            <ZoneRenderer
              zone="weather"
              state={zones.weather}
              weatherApiKey={weatherApiKey}
              weatherLocation={weatherLocation}
            />
          </ZoneErrorBoundary>
        </div>
      )}

      {/* Clock — top-left overlay */}
      <div className="absolute top-4 left-4 z-10">
        <ZoneErrorBoundary zone="clock" screenId={screenId} orgSlug={orgSlug}>
          <ZoneRenderer zone="clock" state={zones.clock} />
        </ZoneErrorBoundary>
      </div>

    </div>
  );
}
