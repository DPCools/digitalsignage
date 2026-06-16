'use client';
import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { AlertTriangle, X } from 'lucide-react';

export default function AlertsPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: alerts, refetch } = trpc.alerts.list.useQuery();
  const active = trpc.alerts.getActive.useQuery();
  const create = trpc.alerts.create.useMutation({ onSuccess: () => { refetch(); active.refetch(); setShowForm(false); setTitle(''); setMessage(''); } });
  const deactivate = trpc.alerts.deactivate.useMutation({ onSuccess: () => { refetch(); active.refetch(); } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Emergency Alerts</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
        >
          <AlertTriangle className="h-4 w-4" />
          New Alert
        </button>
      </div>

      {active.data?.isActive && (
        <div className="rounded-xl border border-red-800 bg-red-950/50 p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-red-400">Active: {active.data.title}</p>
            <p className="text-sm text-red-300">{active.data.message}</p>
          </div>
          <button
            onClick={() => deactivate.mutate({ id: active.data!.id })}
            className="rounded-lg border border-red-700 px-3 py-1 text-sm text-red-400 hover:bg-red-900"
          >
            Deactivate
          </button>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white">New Emergency Alert</h2>
              <button onClick={() => setShowForm(false)}><X className="h-4 w-4 text-gray-400" /></button>
            </div>
            <input placeholder="Alert title" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white" />
            <textarea placeholder="Alert message" value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white resize-none" />
            {create.error && <p className="text-sm text-red-400">{create.error.message}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg border border-gray-700 py-2 text-sm text-gray-300 hover:bg-gray-800">
                Cancel
              </button>
              <button
                onClick={() => create.mutate({ title, message })}
                disabled={!title || !message || create.isPending}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50">
                {create.isPending ? 'Sending…' : 'Broadcast'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {alerts?.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div>
              <p className="font-medium text-white text-sm">{a.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{a.message}</p>
            </div>
            <span className={`text-xs rounded-full px-2 py-0.5 ${a.isActive ? 'bg-red-900 text-red-300' : 'bg-gray-800 text-gray-400'}`}>
              {a.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        ))}
        {alerts?.length === 0 && <p className="text-center text-gray-500 py-12">No alerts yet.</p>}
      </div>
    </div>
  );
}
