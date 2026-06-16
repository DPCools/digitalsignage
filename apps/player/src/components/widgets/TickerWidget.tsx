'use client';
import { useEffect, useState } from 'react';
import type { PlaylistItemConfig } from '@signflow/types';

export function TickerWidget({ items }: { items: PlaylistItemConfig[] }) {
  const [texts, setTexts] = useState<string[]>([]);

  useEffect(() => {
    const loadFeeds = async () => {
      const all: string[] = [];
      for (const item of items) {
        try {
          const res = await fetch(item.url);
          const text = await res.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'application/xml');
          const titles = Array.from(doc.querySelectorAll('item title'))
            .slice(0, 5)
            .map((el) => el.textContent ?? '');
          all.push(...titles);
        } catch { /* non-fatal */ }
      }
      setTexts(all);
    };
    loadFeeds();
    const interval = setInterval(loadFeeds, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [items]);

  if (!texts.length) return null;

  const marqueeText = texts.join('   •   ');
  const duration = Math.max(30, marqueeText.length * 0.1);

  return (
    <div className="h-full flex items-center overflow-hidden bg-black/80">
      <div
        className="whitespace-nowrap text-white text-sm font-medium"
        style={{
          animation: `marquee ${duration}s linear infinite`,
          paddingLeft: '100vw',
        }}
      >
        {marqueeText}
      </div>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
