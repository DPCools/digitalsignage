'use client';
import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { Volume2, Trash2, Plus, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { ConfirmButton } from '@/components/ui/ConfirmButton';

const EMPTY_FORM = { name: '', host: '', port: '80', username: '', password: '' };

export default function AudioBridgeList({ groupId, groupName, onClose }: {
  groupId: string;
  groupName: string;
  onClose: () => void;
}) {
  const { data: bridges, refetch } = trpc.audioBridges.list.useQuery();
  const { data: sounds } = trpc.alertSounds.list.useQuery();
  const create = trpc.audioBridges.create.useMutation({ onSuccess: () => { refetch(); setForm(EMPTY_FORM); setShowAdd(false); } });
  const remove = trpc.audioBridges.delete.useMutation({ onSuccess: () => refetch() });
  const test = trpc.audioBridges.test.useMutation();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [testSoundId, setTestSoundId] = useState('');
  const [testResult, setTestResult] = useState<Record<string, 'ok' | 'fail' | undefined>>({});

  const groupBridges = (bridges ?? []).filter((b) => b.groupId === groupId);

  function runTest(bridge: { id: string; host: string; port: number; username: string }) {
    const sound = sounds?.find((s) => s.id === testSoundId);
    if (!sound) return;
    setTestResult((r) => ({ ...r, [bridge.id]: undefined }));
    test.mutate(
      { id: bridge.id, host: bridge.host, port: bridge.port, username: bridge.username, password: '', soundUrl: sound.url },
      {
        onSuccess: () => setTestResult((r) => ({ ...r, [bridge.id]: 'ok' })),
        onError: () => setTestResult((r) => ({ ...r, [bridge.id]: 'fail' })),
      }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
        <h2 className="font-semibold text-white">Audio Bridges — {groupName}</h2>
        <p className="text-xs text-gray-500">
          Axis Audio Bridge devices at this site. When an alert with a sound triggers for this site, it streams to every bridge listed here.
        </p>

        {sounds && sounds.length > 0 && (
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Test sound</label>
            <select
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
              value={testSoundId}
              onChange={(e) => setTestSoundId(e.target.value)}
            >
              <option value="">Select a sound to test with…</option>
              {sounds.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {groupBridges.length === 0 && (
            <p className="text-sm text-gray-500 py-4 text-center">No audio bridges assigned to this site yet.</p>
          )}
          {groupBridges.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-800 px-3 py-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <Volume2 className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-white">{b.name}</p>
                  <p className="text-xs text-gray-500">{b.host}:{b.port} · {b.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {testResult[b.id] === 'ok' && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                {testResult[b.id] === 'fail' && <XCircle className="h-4 w-4 text-red-400" />}
                <button
                  onClick={() => runTest(b)}
                  disabled={!testSoundId || test.isPending}
                  className="rounded-lg bg-gray-700 hover:bg-gray-600 px-2.5 py-1 text-xs text-gray-200 disabled:opacity-40 flex items-center gap-1"
                >
                  {test.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Test
                </button>
                <ConfirmButton
                  onConfirm={() => remove.mutate({ id: b.id })}
                  pending={remove.isPending}
                  error={remove.error?.message}
                  title="Delete audio bridge?"
                  message={<>Permanently delete <span className="font-medium text-white">{b.name}</span>? Alerts for this site will no longer play to it. This can&rsquo;t be undone.</>}
                  triggerAriaLabel="Delete audio bridge"
                  triggerClassName="text-gray-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </ConfirmButton>
              </div>
            </div>
          ))}
        </div>
        {testResult && Object.values(testResult).includes('fail') && test.error && (
          <p className="text-xs text-red-400">{test.error.message}</p>
        )}

        {showAdd ? (
          <div className="space-y-2 rounded-lg border border-gray-800 p-3">
            <input
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500"
              placeholder="Name (e.g. Reception speaker)"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                className="col-span-2 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500"
                placeholder="Host / IP"
                value={form.host}
                onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
              />
              <input
                className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500"
                placeholder="Port"
                value={form.port}
                onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500"
                placeholder="Username"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              />
              <input
                type="password"
                className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500"
                placeholder="Password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            {create.error && <p className="text-xs text-red-400">{create.error.message}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => { setShowAdd(false); setForm(EMPTY_FORM); }} className="text-sm text-gray-400 hover:text-white px-3 py-1.5">
                Cancel
              </button>
              <button
                disabled={!form.name || !form.host || !form.username || !form.password || create.isPending}
                onClick={() => create.mutate({
                  name: form.name,
                  groupId,
                  host: form.host,
                  port: parseInt(form.port, 10) || 80,
                  username: form.username,
                  password: form.password,
                })}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {create.isPending ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 px-3 py-2 text-xs text-gray-300 hover:text-white transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Audio Bridge
          </button>
        )}

        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-white px-3 py-2">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
