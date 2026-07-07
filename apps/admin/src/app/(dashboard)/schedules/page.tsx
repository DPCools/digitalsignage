'use client';
import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { Calendar, Plus, Trash2 } from 'lucide-react';
import { ConfirmButton } from '@/components/ui/ConfirmButton';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SchedulesPage() {
  const [showForm, setShowForm] = useState(false);
  const { data: schedules, refetch } = trpc.schedules.list.useQuery();
  const { data: playlists } = trpc.playlists.list.useQuery();
  const remove = trpc.schedules.delete.useMutation({ onSuccess: () => refetch() });

  const [form, setForm] = useState({
    playlistId: '',
    name: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    recurrence: 'ONCE' as 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY',
    daysOfWeek: [] as number[],
    priority: 0,
  });

  const create = trpc.schedules.create.useMutation({
    onSuccess: () => { refetch(); setShowForm(false); setForm({ playlistId: '', name: '', startDate: '', endDate: '', startTime: '', endTime: '', recurrence: 'ONCE' as 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY', daysOfWeek: [], priority: 0 }); },
  });

  function toggleDay(d: number) {
    setForm((f) => ({ ...f, daysOfWeek: f.daysOfWeek.includes(d) ? f.daysOfWeek.filter((x) => x !== d) : [...f.daysOfWeek, d] }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Schedules</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Schedule
        </button>
      </div>

      <div className="space-y-3">
        {schedules?.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
              <div>
                <p className="font-medium text-white text-sm">{s.name || s.playlist.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {s.playlist.name} · {new Date(s.startDate).toLocaleDateString()}
                  {s.endDate ? ` – ${new Date(s.endDate).toLocaleDateString()}` : ''}
                  {s.startTime ? ` · ${s.startTime}${s.endTime ? `–${s.endTime}` : ''}` : ''}
                  {' · '}{s.recurrence}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs rounded-full px-2 py-0.5 ${s.isActive ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-400'}`}>
                {s.isActive ? 'Active' : 'Inactive'}
              </span>
              <ConfirmButton
                onConfirm={() => remove.mutate({ id: s.id })}
                pending={remove.isPending}
                error={remove.error?.message}
                title="Delete schedule?"
                message={<>Permanently delete <span className="font-medium text-white">{s.name || s.playlist.name}</span>? This can&rsquo;t be undone.</>}
                triggerAriaLabel="Delete schedule"
                triggerClassName="text-gray-600 hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </ConfirmButton>
            </div>
          </div>
        ))}
        {schedules?.length === 0 && <p className="text-center text-gray-500 py-12">No schedules yet.</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4 overflow-y-auto max-h-[90vh]">
            <h2 className="font-semibold text-white">New Schedule</h2>

            <div className="space-y-3">
              <select
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
                value={form.playlistId}
                onChange={(e) => setForm((f) => ({ ...f, playlistId: e.target.value }))}
              >
                <option value="">Select playlist…</option>
                {playlists?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              <input
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500"
                placeholder="Schedule name (optional)"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Start date</label>
                  <input type="date" className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
                    value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">End date (optional)</label>
                  <input type="date" className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
                    value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Start time (optional)</label>
                  <input type="time" className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
                    value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">End time (optional)</label>
                  <input type="time" className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
                    value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Recurrence</label>
                <select className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
                  value={form.recurrence} onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value as typeof form.recurrence }))}>
                  <option value="ONCE">Once</option>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>

              {form.recurrence === 'WEEKLY' && (
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">Days of week</label>
                  <div className="flex gap-2 flex-wrap">
                    {DAYS.map((d, i) => (
                      <button key={d} type="button" onClick={() => toggleDay(i)}
                        className={`rounded-lg px-3 py-1 text-sm transition-colors ${form.daysOfWeek.includes(i) ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {create.error && <p className="text-sm text-red-400">{create.error.message}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button
                disabled={!form.playlistId || !form.startDate || create.isPending}
                onClick={() => create.mutate({ ...form, startDate: new Date(form.startDate).toISOString(), endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined, screenIds: [], groupIds: [] })}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {create.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
