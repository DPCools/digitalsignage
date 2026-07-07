export type CellMode = 'FIXED' | 'DYNAMIC';

export interface GridPresetCell {
  id: string;              // becomes the PlaylistItem.zone value for items in this cell
  label: string;
  area: string;            // token used in the CSS grid-template-areas string
  defaultMode: CellMode;
  allowFixed: boolean;
  allowDynamic: boolean;
}

export interface GridPreset {
  id: string;
  label: string;
  gridTemplateColumns: string;
  gridTemplateRows: string;
  gridTemplateAreas: string;
  cells: GridPresetCell[];
}

export const GRID_PRESETS: GridPreset[] = [
  {
    id: 'single',
    label: 'Full Screen',
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr',
    gridTemplateAreas: '"main"',
    cells: [
      { id: 'main', label: 'Main', area: 'main', defaultMode: 'DYNAMIC', allowFixed: true, allowDynamic: true },
    ],
  },
  {
    id: '2x2',
    label: '2x2 Grid',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr 1fr',
    gridTemplateAreas: '"a b" "c d"',
    cells: ['a', 'b', 'c', 'd'].map((id) => ({
      id,
      label: id.toUpperCase(),
      area: id,
      defaultMode: 'DYNAMIC' as CellMode,
      allowFixed: true,
      allowDynamic: true,
    })),
  },
  {
    id: 'main-sidebar',
    label: 'Main + Sidebar',
    gridTemplateColumns: '7fr 3fr',
    gridTemplateRows: '1fr',
    gridTemplateAreas: '"main sidebar"',
    cells: [
      { id: 'main', label: 'Main', area: 'main', defaultMode: 'DYNAMIC', allowFixed: true, allowDynamic: true },
      { id: 'sidebar', label: 'Sidebar', area: 'sidebar', defaultMode: 'FIXED', allowFixed: true, allowDynamic: true },
    ],
  },
  {
    id: 'main-ticker',
    label: 'Main + Ticker',
    gridTemplateColumns: '1fr',
    // Fixed 48px ticker row (matches the legacy layout's h-12 bar) rather than
    // "auto", which would collapse to the ticker text's line-height instead
    // of a proper bar.
    gridTemplateRows: '1fr 48px',
    gridTemplateAreas: '"main" "ticker"',
    cells: [
      { id: 'main', label: 'Main', area: 'main', defaultMode: 'DYNAMIC', allowFixed: true, allowDynamic: true },
      { id: 'ticker', label: 'Ticker', area: 'ticker', defaultMode: 'DYNAMIC', allowFixed: false, allowDynamic: true },
    ],
  },
  {
    id: '3-col',
    label: '3 Columns',
    gridTemplateColumns: '1fr 1fr 1fr',
    gridTemplateRows: '1fr',
    gridTemplateAreas: '"a b c"',
    cells: ['a', 'b', 'c'].map((id) => ({
      id,
      label: id.toUpperCase(),
      area: id,
      defaultMode: 'DYNAMIC' as CellMode,
      allowFixed: true,
      allowDynamic: true,
    })),
  },
];

export function getGridPreset(id: string | null | undefined): GridPreset | null {
  if (!id) return null;
  return GRID_PRESETS.find((p) => p.id === id) ?? null;
}

// Today's hardcoded 4-zone layout — the fallback for playlists with no layoutPreset set.
export const LEGACY_ZONE_IDS = ['main', 'ticker', 'clock', 'weather'] as const;
