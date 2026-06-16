'use client';
import { useState } from 'react';
import {
  DndContext, closestCenter, DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { trpc } from '@/lib/trpc-client';
import { GripVertical, Trash2 } from 'lucide-react';

type ContentItem = { id: string; name: string; type: string; thumbnailUrl: string | null };
type PlaylistItemRow = {
  id: string; contentItemId: string; position: number; duration: number;
  transition: string; zone: string; contentItem: ContentItem;
};
type Playlist = { id: string; name: string; items: PlaylistItemRow[] };

function SortableItem({ item, onRemove, onUpdate }: {
  item: PlaylistItemRow;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: string, value: unknown) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 p-3">
      <button {...attributes} {...listeners} aria-label="Drag to reorder" className="text-gray-600 hover:text-gray-400 cursor-grab">
        <GripVertical className="h-4 w-4" />
      </button>
      {item.contentItem.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.contentItem.thumbnailUrl} alt="" className="h-10 w-16 object-cover rounded" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{item.contentItem.name}</p>
        <p className="text-xs text-gray-500">{item.contentItem.type}</p>
      </div>
      <input
        type="number"
        value={item.duration}
        onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) onUpdate(item.id, 'duration', v); }}
        className="w-16 rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-white text-center"
        min={1}
      />
      <span className="text-xs text-gray-500">sec</span>
      <select
        value={item.zone}
        onChange={(e) => onUpdate(item.id, 'zone', e.target.value)}
        className="rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-white"
      >
        {['main', 'ticker', 'clock', 'weather'].map((z) => (
          <option key={z} value={z}>{z}</option>
        ))}
      </select>
      <button onClick={() => onRemove(item.id)} aria-label="Remove item" className="text-gray-600 hover:text-red-400">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function PlaylistBuilder({ playlist, allContent }: {
  playlist: Playlist;
  allContent: ContentItem[];
}) {
  const [items, setItems] = useState(playlist.items);
  const reorder = trpc.playlists.reorderItems.useMutation();
  const remove = trpc.playlists.removeItem.useMutation({
    onSuccess: (_, vars) => setItems((prev) => prev.filter((i) => i.id !== vars.id)),
  });
  const addItem = trpc.playlists.addItem.useMutation({
    onSuccess: (item) => setItems((prev) => [...prev, item as PlaylistItemRow]),
  });
  const updateItem = trpc.playlists.updateItem.useMutation();

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
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
    updateItem.mutate({ id, [field]: value });
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Content library panel */}
      <div className="w-64 shrink-0 space-y-2">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Content Library</h2>
        <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-8rem)]">
          {allContent.map((c) => (
            <button
              key={c.id}
              onClick={() => addItem.mutate({ playlistId: playlist.id, contentItemId: c.id })}
              disabled={addItem.isPending}
              className="w-full text-left flex items-center gap-2 rounded-lg p-2 hover:bg-gray-800 text-sm disabled:opacity-50"
            >
              {c.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.thumbnailUrl} alt="" className="h-8 w-12 object-cover rounded" />
              )}
              <div className="min-w-0">
                <p className="text-white truncate">{c.name}</p>
                <p className="text-xs text-gray-500">{c.type}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Playlist items */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          {playlist.name} — {items.length} item{items.length !== 1 ? 's' : ''}
        </h2>
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                onRemove={(id) => remove.mutate({ id })}
                onUpdate={handleUpdate}
              />
            ))}
          </SortableContext>
        </DndContext>
        {items.length === 0 && (
          <p className="text-center text-gray-500 py-12 text-sm">
            Click items from the library to add them to this playlist.
          </p>
        )}
      </div>
    </div>
  );
}
