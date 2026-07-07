'use client';
import { useCallback, useMemo, useRef, useState } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getGridPreset } from '@signflow/types';
import { trpc } from '@/lib/trpc-client';
import { LayoutPresetPicker, type CellConfigEntry } from './LayoutPresetPicker';
import { GripVertical, Trash2, Check, Loader2, Plus } from 'lucide-react';

type ContentItem = {
  id: string; name: string; type: string; url: string; thumbnailUrl: string | null;
};
type TransitionType = 'FADE' | 'SLIDE_LEFT' | 'SLIDE_RIGHT' | 'ZOOM' | 'NONE';
type PlaylistItemRow = {
  id: string; contentItemId: string; position: number;
  duration: number; transition: TransitionType; zone: string;
  contentItem: ContentItem;
};
type Playlist = {
  id: string; name: string; items: PlaylistItemRow[];
  layoutPreset: string | null; cellConfig: unknown;
};

// Fallback cell list for playlists with no grid layoutPreset set — today's
// exact 4-zone layout, unchanged.
const LEGACY_CELLS = [
  { id: 'main', label: 'Main' },
  { id: 'ticker', label: 'Ticker' },
  { id: 'clock', label: 'Clock' },
  { id: 'weather', label: 'Weather' },
];

function parseCellConfigEntries(raw: unknown): CellConfigEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is CellConfigEntry =>
      e && typeof e === 'object' && typeof e.cellId === 'string' && (e.mode === 'FIXED' || e.mode === 'DYNAMIC')
  );
}

const TRANSITIONS: { value: TransitionType; label: string }[] = [
  { value: 'FADE',        label: 'Fade' },
  { value: 'SLIDE_LEFT',  label: 'Slide ←' },
  { value: 'SLIDE_RIGHT', label: 'Slide →' },
  { value: 'ZOOM',        label: 'Zoom' },
  { value: 'NONE',        label: 'Cut' },
];

function Preview({ item, className }: { item: ContentItem; className?: string }) {
  if (item.type === 'IMAGE') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.url} alt={item.name} className={`object-cover ${className ?? ''}`} />;
  }
  if (item.type === 'VIDEO') {
    return (
      <video
        src={item.url}
        className={`object-contain bg-black ${className ?? ''}`}
        muted
        preload="metadata"
      />
    );
  }
  return (
    <div className={`flex items-center justify-center bg-gray-800 text-gray-500 text-[10px] uppercase ${className ?? ''}`}>
      {item.type.replace('_', ' ')}
    </div>
  );
}

type SaveState = 'idle' | 'saving' | 'saved';

function SortableItem({
  item, cells, onRemove, onUpdate, saveState, error,
}: {
  item: PlaylistItemRow;
  cells: { id: string; label: string }[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: string, value: unknown) => void;
  saveState: SaveState;
  error?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-gray-800 bg-gray-900 p-3 hover:border-gray-700 transition-colors"
    >
      {/* Top row: drag + preview + name + actions */}
      <div className="flex items-start gap-3">
        <button
          {...attributes} {...listeners}
          aria-label="Drag to reorder"
          className="mt-1 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing shrink-0"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="w-24 h-14 rounded overflow-hidden shrink-0 bg-gray-800">
          <Preview item={item.contentItem} className="w-full h-full" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate leading-tight">{item.contentItem.name}</p>
          <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
            {item.contentItem.type.replace('_', ' ')}
          </span>
        </div>

        {/* Save indicator + delete */}
        <div className="flex items-center gap-2 shrink-0">
          {saveState === 'saving' && (
            <Loader2 className="h-3 w-3 text-gray-500 animate-spin" />
          )}
          {saveState === 'saved' && (
            <span className="flex items-center gap-0.5 text-[10px] text-green-500">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          <button
            onClick={() => onRemove(item.id)}
            aria-label="Remove"
            className="rounded p-1 text-gray-600 hover:text-red-400 hover:bg-gray-800 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Controls row */}
      <div className="mt-3 pl-7 space-y-2.5">

        {/* Duration — videos play to completion so no fixed duration needed */}
        {item.contentItem.type !== 'VIDEO' && (
          <div className="flex items-center gap-3">
            <span className="w-20 text-xs text-gray-400 shrink-0">Duration</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={item.duration}
                min={1}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 1) onUpdate(item.id, 'duration', v);
                }}
                className="w-16 rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-blue-500"
              />
              <span className="text-xs text-gray-500">sec</span>
            </div>
          </div>
        )}

        {/* Zone — pill radio buttons */}
        <div className="flex items-center gap-3">
          <span className="w-20 text-xs text-gray-400 shrink-0">Cell</span>
          <div className="flex gap-1 flex-wrap">
            {cells.map((c) => (
              <button
                key={c.id}
                onClick={() => onUpdate(item.id, 'zone', c.id)}
                className={`rounded-full px-3 py-0.5 text-xs font-medium transition-colors ${
                  item.zone === c.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transition */}
        <div className="flex items-center gap-3">
          <span className="w-20 text-xs text-gray-400 shrink-0">Transition</span>
          <div className="flex gap-1 flex-wrap">
            {TRANSITIONS.map((t) => (
              <button
                key={t.value}
                onClick={() => onUpdate(item.id, 'transition', t.value)}
                className={`rounded-full px-3 py-0.5 text-xs font-medium transition-colors ${
                  item.transition === t.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

      </div>
    </div>
  );
}

export function PlaylistBuilder({ playlist, allContent }: {
  playlist: Playlist;
  allContent: ContentItem[];
}) {
  const [items, setItems] = useState<PlaylistItemRow[]>(playlist.items);
  const [saveStates, setSaveStates] = useState<Map<string, SaveState>>(new Map());
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const dirtyItems = useRef<Map<string, PlaylistItemRow>>(new Map());

  const [layoutPreset, setLayoutPreset] = useState<string | null>(playlist.layoutPreset);
  const [cellConfig, setCellConfig] = useState<CellConfigEntry[]>(parseCellConfigEntries(playlist.cellConfig));
  const cells = useMemo(
    () => getGridPreset(layoutPreset)?.cells.map((c) => ({ id: c.id, label: c.label })) ?? LEGACY_CELLS,
    [layoutPreset]
  );

  const [itemErrors, setItemErrors] = useState<Map<string, string>>(new Map());
  const [addError, setAddError] = useState<string | null>(null);

  const showItemError = useCallback((id: string, message: string) => {
    setItemErrors((prev) => new Map(prev).set(id, message));
    setTimeout(() => setItemErrors((prev) => { const next = new Map(prev); next.delete(id); return next; }), 4000);
  }, []);

  const reorder  = trpc.playlists.reorderItems.useMutation();
  const remove   = trpc.playlists.removeItem.useMutation({
    onSuccess: (_, vars) => setItems((prev) => prev.filter((i) => i.id !== vars.id)),
  });
  const addItem  = trpc.playlists.addItem.useMutation({
    onSuccess: (item: unknown) => setItems((prev) => [...prev, item as PlaylistItemRow]),
    onError: (error) => {
      setAddError(error.message);
      setTimeout(() => setAddError(null), 4000);
    },
  });
  const updateItem = trpc.playlists.updateItem.useMutation();

  const setSaveState = useCallback((id: string, state: SaveState) => {
    setSaveStates((prev) => new Map(prev).set(id, state));
  }, []);

  // When the layout preset changes, any item whose zone doesn't exist as a
  // cell in the new preset would otherwise be silently orphaned — invisible
  // in this picker (no pill matches) AND dropped entirely by the player,
  // since PlaylistEngine only queues items into zones the preset actually
  // defines. Reassign orphaned items to the new preset's first cell so
  // content is never silently lost.
  function handleLayoutChange(newPreset: string | null, newCellConfig: CellConfigEntry[]) {
    setLayoutPreset(newPreset);
    setCellConfig(newCellConfig);

    const validZoneIds = newPreset
      ? getGridPreset(newPreset)?.cells.map((c) => c.id) ?? []
      : LEGACY_CELLS.map((c) => c.id);
    const fallbackZone = validZoneIds[0] ?? 'main';

    setItems((prev) => prev.map((item) => {
      if (validZoneIds.includes(item.zone)) return item;
      updateItem.mutate(
        { id: item.id, zone: fallbackZone },
        { onError: (error) => showItemError(item.id, error.message) }
      );
      return { ...item, zone: fallbackZone };
    }));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    const previous = items;
    const reordered = arrayMove(items, oldIdx, newIdx);
    setItems(reordered);
    reorder.mutate(
      { playlistId: playlist.id, itemIds: reordered.map((i) => i.id) },
      { onError: () => setItems(previous) },
    );
  }

  function handleUpdate(id: string, field: string, value: unknown) {
    // Snapshot for revert if the server rejects this change (e.g. moving a
    // second item into an already-full fixed cell).
    const previousItem = items.find((i) => i.id === id);

    // Update local state immediately
    setItems((prev) => {
      const updated = prev.map((i) => (i.id === id ? { ...i, [field]: value } : i));
      const item = updated.find((i) => i.id === id);
      if (item) dirtyItems.current.set(id, item);
      return updated;
    });

    // Debounced save — accumulates all field changes within 600ms into one mutation
    const existing = saveTimers.current.get(id);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      const dirty = dirtyItems.current.get(id);
      dirtyItems.current.delete(id);
      if (!dirty) return;

      setSaveState(id, 'saving');
      updateItem.mutate(
        { id, duration: dirty.duration, zone: dirty.zone, transition: dirty.transition },
        {
          onSuccess: () => {
            setSaveState(id, 'saved');
            setTimeout(() => setSaveState(id, 'idle'), 2000);
          },
          onError: (error) => {
            setSaveState(id, 'idle');
            if (previousItem) setItems((prev) => prev.map((i) => (i.id === id ? previousItem : i)));
            showItemError(id, error.message);
          },
        }
      );
    }, 600);

    saveTimers.current.set(id, timer);
  }

  const mainDuration = items
    .filter((i) => i.zone === 'main')
    .reduce((s, i) => s + i.duration, 0);

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-5rem)]">
      <LayoutPresetPicker
        playlistId={playlist.id}
        layoutPreset={layoutPreset}
        cellConfig={cellConfig}
        onChange={handleLayoutChange}
      />

    <div className="flex gap-0 flex-1 min-h-0">

      {/* ── Content library ── */}
      <div className="w-52 shrink-0 flex flex-col gap-3 pr-4 border-r border-gray-800">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-1">
          Content Library
        </h2>
        {addError && <p className="text-xs text-red-400">{addError}</p>}
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {allContent.map((c) => (
            <button
              key={c.id}
              onClick={() => addItem.mutate({ playlistId: playlist.id, contentItemId: c.id })}
              disabled={addItem.isPending}
              className="group w-full text-left flex items-center gap-2 rounded-lg p-1.5 hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <div className="w-16 h-10 rounded overflow-hidden shrink-0 bg-gray-900">
                <Preview item={c} className="w-full h-full" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white truncate leading-snug">{c.name}</p>
                <p className="text-[10px] text-gray-500 uppercase">{c.type.replace('_', ' ')}</p>
              </div>
              <Plus className="h-3.5 w-3.5 text-gray-700 group-hover:text-blue-400 shrink-0 transition-colors" />
            </button>
          ))}
          {allContent.length === 0 && (
            <p className="text-xs text-gray-500 py-6 text-center">No approved content.</p>
          )}
        </div>
      </div>

      {/* ── Playlist items ── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 pl-6">
        <div className="flex items-center justify-between pt-1">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {playlist.name} — {items.length} item{items.length !== 1 ? 's' : ''}
          </h2>
          {mainDuration > 0 && (
            <span className="text-xs text-gray-500">
              Main loop:{' '}
              {mainDuration >= 60
                ? `${Math.floor(mainDuration / 60)}m ${mainDuration % 60}s`
                : `${mainDuration}s`}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {items.map((item) => (
                <SortableItem
                  key={item.id}
                  item={item}
                  cells={cells}
                  onRemove={(id) => remove.mutate({ id })}
                  onUpdate={handleUpdate}
                  saveState={saveStates.get(item.id) ?? 'idle'}
                  error={itemErrors.get(item.id)}
                />
              ))}
            </SortableContext>
          </DndContext>

          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 rounded-xl border border-dashed border-gray-800 text-center gap-2">
              <p className="text-sm text-gray-500">No items yet.</p>
              <p className="text-xs text-gray-600">Click content in the library to add it here.</p>
            </div>
          )}
        </div>
      </div>

    </div>
    </div>
  );
}
