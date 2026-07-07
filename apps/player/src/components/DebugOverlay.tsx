'use client';
import type { EngineState } from '@/engine/PlaylistEngine';

export function DebugOverlay({ state, screenId, orgSlug, visible }: {
  state: EngineState;
  screenId: string;
  orgSlug: string;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-4 left-4 z-[9998] bg-black/80 text-green-400 text-xs font-mono p-3 rounded-lg space-y-1 max-w-xs">
      <p>Screen: {screenId}</p>
      <p>Org: {orgSlug}</p>
      <p>Playlist: {state.activePlaylist?.name ?? 'none'}</p>
      {Object.keys(state.zones).map((z) => (
        <p key={z}>{z}{state.zones[z].isFixed ? ' (fixed)' : ''}: {state.zones[z].currentItem?.id ?? 'none'}</p>
      ))}
    </div>
  );
}
