'use client';
import type { ZoneState } from '@/engine/PlaylistEngine';
import type { Zone } from '@signflow/types';
import { ContentPlayer } from './ContentPlayer';
import { TransitionWrapper } from './TransitionWrapper';
import { ClockWidget } from './widgets/ClockWidget';
import { WeatherWidget } from './widgets/WeatherWidget';
import { TickerWidget } from './widgets/TickerWidget';

interface Props {
  zone: Zone;
  state: ZoneState;
  weatherApiKey?: string;
  weatherLocation?: string;
  onVideoEnd?: () => void;
}

export function ZoneRenderer({ zone, state, weatherApiKey, weatherLocation, onVideoEnd }: Props) {
  if (zone === 'clock') return <ClockWidget />;

  if (zone === 'weather') {
    return <WeatherWidget apiKey={weatherApiKey} location={weatherLocation} />;
  }

  if (zone === 'ticker') {
    const rssItems = state.items.filter((i) => i.type === 'RSS_FEED');
    return <TickerWidget items={rssItems} />;
  }

  // main zone
  if (!state.currentItem) return null;

  return (
    <TransitionWrapper
      transitionType={state.currentItem.transition}
      itemKey={state.currentItem.id}
    >
      <ContentPlayer key={state.currentItem.id} item={state.currentItem} onVideoEnd={onVideoEnd} />
    </TransitionWrapper>
  );
}
