'use client';
import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { Layers, Plus, Trash2, Pencil, Monitor, ListVideo } from 'lucide-react';

type GroupType = 'SITE' | 'LOCATION' | 'DEPARTMENT' | 'OTHER';

const TYPE_LABELS: Record<GroupType, string> = {
  SITE: 'Site',
  LOCATION: 'Location',
  DEPARTMENT: 'Department',
  OTHER: 'Other',
};

const TYPE_COLORS: Record<GroupType, string> = {
  SITE: 'bg-blue-900 text-blue-300',
  LOCATION: 'bg-green-900 text-green-300',
  DEPARTMENT: 'bg-purple-900 text-purple-300',
  OTHER: 'bg-gray-800 text-gray-400',
};

const EMPTY_FORM = { name: '', type: 'OTHER' as GroupType, location: '', description: '', defaultPlaylistId: '' };

export default function GroupsPage() {
  const { data: groups, refetch } = trpc.screenGroups.list.useQuery();
  const { data: allScreens } = trpc.screens.list.useQuery();
  const { data: allPlaylists } = trpc.playlists.list.useQuery();
  const create = trpc.screenGroups.create.useMutation({ onSuccess: () => { refetch(); setShowForm(false); setForm(EMPTY_FORM); } });
  const update = trpc.screenGroups.update.useMutation({ onSuccess: () => { refetch(); setEditing(null); } });
  const remove = trpc.screenGroups.delete.useMutation({ onSuccess: () => refetch() });
  const setScreens = trpc.screenGroups.setScreens.useMutation({ onSuccess: () => { refetch(); setManagingGroup(null); } });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [managingGroup, setManagingGroup] = useState<{ id: string; name: string } | null>(null);
  const [selectedScreenIds, setSelectedScreenIds] = useState<Set<string>>(new Set());

  function startEdit(g: { id: string; name: string; type: string; location: string | null; description: string | null; defaultPlaylistId: string | null }) {
    setEditing(g.id);
    setEditForm({ name: g.name, type: g.type as GroupType, location: g.location ?? '', description: g.description ?? '', defaultPlaylistId: g.defaultPlaylistId ?? '' });
  }

  function openManage(g: { id: string; name: string }) {
    setManagingGroup(g);
    const current = new Set((allScreens ?? []).filter((s) => s.groupId === g.id).map((s) => s.id));
    setSelectedScreenIds(current);
  }

  function toggleScreen(id: string) {
    setSelectedScreenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const grouped = Object.entries(TYPE_LABELS).map(([type, label]) => ({
    type: type as GroupType,
    label,
    items: (groups ?? []).filter((g) => g.type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Screen Groups</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Group
        </button>
      </div>

      {groups?.length === 0 && (
        <div className="text-center text-gray-500 py-16">
          <Layers className="h-10 w-10 mx-auto mb-3 text-gray-700" />
          <p>No groups yet. Create one to organise your screens by site, location, or department.</p>
        </div>
      )}

      {grouped.map(({ type, label, items }) => (
        <div key={type} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</h2>
          <div className="space-y-2">
            {items.map((g) => (
              <div key={g.id} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                {editing === g.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
                        placeholder="Group name"
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      />
                      <select
                        className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
                        value={editForm.type}
                        onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value as GroupType }))}
                      >
                        {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <input
                      className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
                      placeholder="Location (optional)"
                      value={editForm.location}
                      onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                    />
                    <input
                      className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
                      placeholder="Description (optional)"
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    />
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Default Playlist</label>
                      <select
                        className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
                        value={editForm.defaultPlaylistId}
                        onChange={(e) => setEditForm((f) => ({ ...f, defaultPlaylistId: e.target.value }))}
                      >
                        <option value="">No default playlist</option>
                        {allPlaylists?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditing(null)} className="text-sm text-gray-400 hover:text-white px-3 py-1">Cancel</button>
                      <button
                        disabled={!editForm.name || update.isPending}
                        onClick={() => update.mutate({ id: g.id, ...editForm, location: editForm.location || null, description: editForm.description || null, defaultPlaylistId: editForm.defaultPlaylistId || null })}
                        className="rounded-lg bg-blue-600 px-4 py-1 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Layers className="h-4 w-4 text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-white text-sm">{g.name}</p>
                          <span className={`text-xs rounded-full px-2 py-0.5 ${TYPE_COLORS[g.type as GroupType]}`}>
                            {TYPE_LABELS[g.type as GroupType]}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 flex-wrap">
                          {g.location && <span>{g.location} ·</span>}
                          <Monitor className="h-3 w-3 inline-block" />
                          <span>{g._count.screens} screen{g._count.screens !== 1 ? 's' : ''}</span>
                          {g.defaultPlaylist ? (
                            <>
                              <span>·</span>
                              <ListVideo className="h-3 w-3 inline-block" />
                              <span className="text-blue-400">{g.defaultPlaylist.name}</span>
                            </>
                          ) : (
                            <span className="text-yellow-600">· No playlist assigned</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openManage(g)}
                        className="flex items-center gap-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:text-white transition-colors"
                      >
                        <Monitor className="h-3.5 w-3.5" />
                        Assign Screens
                      </button>
                      <button onClick={() => startEdit(g)} className="text-gray-600 hover:text-white transition-colors">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove.mutate({ id: g.id })}
                        disabled={remove.isPending}
                        className="text-gray-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* New group modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
            <h2 className="font-semibold text-white">New Group</h2>
            <div className="space-y-3">
              <input
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500"
                placeholder="Group name *"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <select
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as GroupType }))}
              >
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500"
                placeholder="Location (e.g. London HQ, Floor 2)"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
              <input
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500"
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Default Playlist (optional)</label>
                <select
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
                  value={form.defaultPlaylistId}
                  onChange={(e) => setForm((f) => ({ ...f, defaultPlaylistId: e.target.value }))}
                >
                  <option value="">No default playlist</option>
                  {allPlaylists?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            {create.error && <p className="text-sm text-red-400">{create.error.message}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="text-sm text-gray-400 hover:text-white px-3 py-2">
                Cancel
              </button>
              <button
                disabled={!form.name || create.isPending}
                onClick={() => create.mutate({ ...form, location: form.location || undefined, description: form.description || undefined, defaultPlaylistId: form.defaultPlaylistId || undefined })}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {create.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign screens modal */}
      {managingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
            <h2 className="font-semibold text-white">Assign Screens — {managingGroup.name}</h2>
            <p className="text-xs text-gray-500">Check the screens that belong to this group.</p>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {(allScreens ?? []).length === 0 && (
                <p className="text-sm text-gray-500 py-4 text-center">No screens registered yet.</p>
              )}
              {(allScreens ?? []).map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedScreenIds.has(s.id)}
                    onChange={() => toggleScreen(s.id)}
                    className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-sm text-white">{s.name}</p>
                    {s.group && s.group.id !== managingGroup.id && (
                      <p className="text-xs text-yellow-500">Currently in: {s.group.name}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
            {setScreens.error && <p className="text-sm text-red-400">{setScreens.error.message}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setManagingGroup(null)} className="text-sm text-gray-400 hover:text-white px-3 py-2">
                Cancel
              </button>
              <button
                disabled={setScreens.isPending}
                onClick={() => setScreens.mutate({ groupId: managingGroup.id, screenIds: [...selectedScreenIds] })}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {setScreens.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
