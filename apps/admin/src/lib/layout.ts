import { getGridPreset, type CellMode } from '@signflow/types';

// Defensively parses the Playlist.cellConfig Json? column into a lookup map —
// malformed or missing data (e.g. a playlist that predates this feature)
// simply yields no overrides.
export function parseCellConfig(raw: unknown): Record<string, CellMode> {
  if (!Array.isArray(raw)) return {};
  const result: Record<string, CellMode> = {};
  for (const entry of raw) {
    if (
      entry && typeof entry === 'object' &&
      typeof (entry as { cellId?: unknown }).cellId === 'string' &&
      ((entry as { mode?: unknown }).mode === 'FIXED' || (entry as { mode?: unknown }).mode === 'DYNAMIC')
    ) {
      result[(entry as { cellId: string }).cellId] = (entry as { mode: CellMode }).mode;
    }
  }
  return result;
}

// Mirrors PlaylistEngine's resolveIsFixed logic on the server side, so the
// "one item per fixed cell" invariant can be enforced at mutation time.
export function resolveCellMode(
  layoutPreset: string | null | undefined,
  cellConfig: unknown,
  zone: string
): CellMode {
  if (!layoutPreset) return 'DYNAMIC';
  const preset = getGridPreset(layoutPreset);
  const cellModes = parseCellConfig(cellConfig);
  return cellModes[zone] ?? preset?.cells.find((c) => c.id === zone)?.defaultMode ?? 'DYNAMIC';
}
