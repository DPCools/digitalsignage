'use client';
import type { GridPreset } from '@signflow/types';
import { ZoneRenderer } from './ZoneRenderer';
import { ZoneErrorBoundary } from './ZoneErrorBoundary';
import type { ScreenLayoutProps } from './LegacyScreenLayout';

interface Props extends ScreenLayoutProps {
  preset: GridPreset;
}

// Data-driven CSS grid renderer for arbitrary layout presets — same
// grid-template-areas technique already used by CctvGrid in ContentPlayer.tsx.
export function GridScreenLayout({ preset, zones, screenId, orgSlug, weatherApiKey, weatherLocation, streamToken, onVideoEnd }: Props) {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-black grid"
      style={{
        gridTemplateColumns: preset.gridTemplateColumns,
        gridTemplateRows: preset.gridTemplateRows,
        gridTemplateAreas: preset.gridTemplateAreas,
      }}
    >
      {preset.cells.map((cell) => (
        <div key={cell.id} style={{ gridArea: cell.area }} className="relative overflow-hidden">
          <ZoneErrorBoundary zone={cell.id} screenId={screenId} orgSlug={orgSlug}>
            <ZoneRenderer
              zone={cell.id}
              state={zones[cell.id]}
              screenId={screenId}
              orgSlug={orgSlug}
              weatherApiKey={weatherApiKey}
              weatherLocation={weatherLocation}
              streamToken={streamToken}
              onVideoEnd={() => onVideoEnd(cell.id)}
            />
          </ZoneErrorBoundary>
        </div>
      ))}
    </div>
  );
}
