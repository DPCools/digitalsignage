'use client';
import { useState } from 'react';
import { GRID_PRESETS, type CellMode, type GridPreset } from '@signflow/types';
import { trpc } from '@/lib/trpc-client';
import { Check, Loader2 } from 'lucide-react';

export interface CellConfigEntry { cellId: string; mode: CellMode }

type SaveState = 'idle' | 'saving' | 'saved';

function MiniGridPreview({ preset }: { preset: GridPreset }) {
  return (
    <div
      className="grid gap-0.5 w-full h-10"
      style={{
        gridTemplateColumns: preset.gridTemplateColumns,
        gridTemplateRows: preset.gridTemplateRows,
        gridTemplateAreas: preset.gridTemplateAreas,
      }}
    >
      {preset.cells.map((c) => (
        <div key={c.id} style={{ gridArea: c.area }} className="bg-gray-700 rounded-sm" />
      ))}
    </div>
  );
}

export function LayoutPresetPicker({
  playlistId, layoutPreset, cellConfig, onChange,
}: {
  playlistId: string;
  layoutPreset: string | null;
  cellConfig: CellConfigEntry[];
  onChange: (layoutPreset: string | null, cellConfig: CellConfigEntry[]) => void;
}) {
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const update = trpc.playlists.update.useMutation({
    onSuccess: () => {
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    },
    onError: () => setSaveState('idle'),
  });

  const activePreset = GRID_PRESETS.find((p) => p.id === layoutPreset) ?? null;

  function selectPreset(preset: GridPreset | null) {
    const nextPresetId = preset?.id ?? null;
    // Cell ids from a previous preset almost never match the new one — reset.
    const nextCellConfig: CellConfigEntry[] = [];
    onChange(nextPresetId, nextCellConfig);
    setSaveState('saving');
    update.mutate({ id: playlistId, layoutPreset: nextPresetId, cellConfig: nextCellConfig });
  }

  function toggleCellMode(cellId: string, defaultMode: CellMode) {
    const current = cellConfig.find((c) => c.cellId === cellId)?.mode ?? defaultMode;
    const next: CellMode = current === 'FIXED' ? 'DYNAMIC' : 'FIXED';
    const nextCellConfig = [...cellConfig.filter((c) => c.cellId !== cellId), { cellId, mode: next }];
    onChange(layoutPreset, nextCellConfig);
    setSaveState('saving');
    update.mutate({ id: playlistId, cellConfig: nextCellConfig });
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Screen Layout</h3>
        <div className="flex items-center gap-2">
          {saveState === 'saving' && <Loader2 className="h-3 w-3 text-gray-500 animate-spin" />}
          {saveState === 'saved' && (
            <span className="flex items-center gap-0.5 text-[10px] text-green-500">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => selectPreset(null)}
          className={`rounded-lg border p-2 text-center transition-colors ${
            !activePreset ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="w-full h-10 flex flex-col gap-0.5">
            <div className="flex-1 bg-gray-700 rounded-sm" />
            <div className="h-1.5 bg-gray-700 rounded-sm" />
          </div>
          <p className="mt-1 text-[10px] text-gray-400">Classic (Main + Overlays)</p>
        </button>
        {GRID_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => selectPreset(preset)}
            className={`rounded-lg border p-2 text-center transition-colors ${
              activePreset?.id === preset.id ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800 hover:border-gray-700'
            }`}
          >
            <MiniGridPreview preset={preset} />
            <p className="mt-1 text-[10px] text-gray-400">{preset.label}</p>
          </button>
        ))}
      </div>

      {activePreset && (
        <div className="flex flex-wrap gap-2 pt-1">
          {activePreset.cells.map((cell) => {
            const mode = cellConfig.find((c) => c.cellId === cell.id)?.mode ?? cell.defaultMode;
            return (
              <button
                key={cell.id}
                onClick={() => toggleCellMode(cell.id, cell.defaultMode)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  mode === 'FIXED'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {cell.label}: {mode === 'FIXED' ? 'Fixed' : 'Dynamic'}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
