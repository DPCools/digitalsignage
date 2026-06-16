'use client';
import type { PlaylistItemConfig } from '@signflow/types';

export function TickerWidget({ items }: { items: PlaylistItemConfig[] }) {
  if (!items.length) return null;
  return (
    <div className="flex items-center h-full overflow-hidden text-white text-sm px-4">
      <div className="animate-marquee whitespace-nowrap">
        {items.map((i) => i.url).join('  •  ')}
      </div>
    </div>
  );
}
