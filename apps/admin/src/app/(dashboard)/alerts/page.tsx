'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/trpc-client';
import {
  AlertTriangle, X, Key, Zap, Trash2, Edit2, Copy, Check, Loader2, Plus,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Clipboard helper — falls back to execCommand for non-HTTPS / Windows
// ---------------------------------------------------------------------------
async function copyText(text: string): Promise<void> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch { /* fall through */ }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Tab = 'active' | 'templates' | 'apikeys';

type TemplateFormState = {
  name: string; title: string; message: string;
  backgroundColor: string; textColor: string;
  targetType: 'ALL' | 'GROUPS' | 'SCREENS';
  targetGroupIds: string[]; targetScreenIds: string[];
  autoExpireMinutes: string;
};

const defaultTemplateForm = (): TemplateFormState => ({
  name: '', title: '', message: '',
  backgroundColor: '#FF0000', textColor: '#FFFFFF',
  targetType: 'ALL', targetGroupIds: [], targetScreenIds: [],
  autoExpireMinutes: '',
});

// ---------------------------------------------------------------------------
// TemplateModal
// ---------------------------------------------------------------------------
function TemplateModal({
  editId,
  initial,
  onClose,
  onSaved,
}: {
  editId?: string;
  initial: TemplateFormState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<TemplateFormState>(initial);

  const groups = trpc.screenGroups.list.useQuery();
  const screens = trpc.screens.list.useQuery();
  const create = trpc.alertTemplates.create.useMutation({ onSuccess: onSaved });
  const update = trpc.alertTemplates.update.useMutation({ onSuccess: onSaved });

  const isPending = create.isPending || update.isPending;
  const error = create.error?.message ?? update.error?.message;

  function set<K extends keyof TemplateFormState>(k: K, v: TemplateFormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleArr(arr: string[], id: string) {
    return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
  }

  function handleSubmit() {
    const base = {
      name: form.name, title: form.title, message: form.message,
      backgroundColor: form.backgroundColor, textColor: form.textColor,
      targetType: form.targetType,
      targetGroupIds: form.targetGroupIds,
      targetScreenIds: form.targetScreenIds,
      autoExpireMinutes: form.autoExpireMinutes ? parseInt(form.autoExpireMinutes, 10) : undefined,
    };
    if (editId) {
      update.mutate({ id: editId, ...base });
    } else {
      create.mutate(base);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">{editId ? 'Edit Template' : 'New Template'}</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-gray-400" /></button>
        </div>

        <input placeholder="Template name" value={form.name} onChange={(e) => set('name', e.target.value)}
          className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
        <input placeholder="Alert title" value={form.title} onChange={(e) => set('title', e.target.value)}
          className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
        <textarea placeholder="Alert message" value={form.message} onChange={(e) => set('message', e.target.value)}
          rows={3} className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm resize-none" />

        {/* Color pickers */}
        <div className="flex gap-4">
          <label className="flex-1">
            <span className="text-xs text-gray-400 block mb-1">Background Color</span>
            <div className="flex items-center gap-2">
              <input type="color" value={form.backgroundColor} onChange={(e) => set('backgroundColor', e.target.value)}
                className="h-8 w-12 rounded cursor-pointer bg-gray-800 border border-gray-700" />
              <span className="text-xs text-gray-400 font-mono">{form.backgroundColor}</span>
            </div>
          </label>
          <label className="flex-1">
            <span className="text-xs text-gray-400 block mb-1">Text Color</span>
            <div className="flex items-center gap-2">
              <input type="color" value={form.textColor} onChange={(e) => set('textColor', e.target.value)}
                className="h-8 w-12 rounded cursor-pointer bg-gray-800 border border-gray-700" />
              <span className="text-xs text-gray-400 font-mono">{form.textColor}</span>
            </div>
          </label>
        </div>

        {/* Target type */}
        <div>
          <span className="text-xs text-gray-400 block mb-2">Target</span>
          <div className="flex gap-3">
            {(['ALL', 'GROUPS', 'SCREENS'] as const).map((t) => (
              <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="targetType" checked={form.targetType === t}
                  onChange={() => set('targetType', t)} className="accent-red-500" />
                <span className="text-sm text-gray-300">
                  {t === 'ALL' ? 'All Screens' : t === 'GROUPS' ? 'By Group' : 'By Screen'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {form.targetType === 'GROUPS' && (
          <div className="space-y-1 max-h-40 overflow-y-auto rounded-lg border border-gray-700 p-3">
            {groups.data?.map((g) => (
              <label key={g.id} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.targetGroupIds.includes(g.id)}
                  onChange={() => set('targetGroupIds', toggleArr(form.targetGroupIds, g.id))}
                  className="accent-red-500" />
                <span className="text-sm text-white">{g.name}</span>
                <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">{g.type}</span>
              </label>
            ))}
            {groups.data?.length === 0 && <p className="text-xs text-gray-500">No groups available.</p>}
          </div>
        )}

        {form.targetType === 'SCREENS' && (
          <div className="space-y-1 max-h-40 overflow-y-auto rounded-lg border border-gray-700 p-3">
            {screens.data?.map((s) => (
              <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.targetScreenIds.includes(s.id)}
                  onChange={() => set('targetScreenIds', toggleArr(form.targetScreenIds, s.id))}
                  className="accent-red-500" />
                <span className="text-sm text-white">{s.name}</span>
              </label>
            ))}
            {screens.data?.length === 0 && <p className="text-xs text-gray-500">No screens available.</p>}
          </div>
        )}

        {/* Auto-expire */}
        <div>
          <span className="text-xs text-gray-400 block mb-1">Auto-clear after _ minutes (leave blank = manual only)</span>
          <input type="number" min={1} placeholder="e.g. 30" value={form.autoExpireMinutes}
            onChange={(e) => set('autoExpireMinutes', e.target.value)}
            className="w-32 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 rounded-lg border border-gray-700 py-2 text-sm text-gray-300 hover:bg-gray-800">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!form.name || !form.title || !form.message || isPending}
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 flex items-center justify-center gap-1">
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {editId ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NewKeyModal
// ---------------------------------------------------------------------------
function NewKeyModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [rawKey, setRawKey] = useState('');
  const [copied, setCopied] = useState(false);

  const create = trpc.apiKeys.create.useMutation({
    onSuccess: (data) => { setRawKey(data.rawKey); onCreated(); },
  });

  async function handleCopy() {
    await copyText(rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (rawKey) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">API Key Created</h2>
            <button onClick={onClose}><X className="h-4 w-4 text-gray-400" /></button>
          </div>
          <div className="rounded-lg bg-yellow-950/50 border border-yellow-800 px-4 py-3">
            <p className="text-xs text-yellow-400 font-medium">This key will not be shown again. Copy it now.</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2">
            <code className="flex-1 text-xs text-green-400 break-all font-mono">{rawKey}</code>
            <button onClick={handleCopy} className="shrink-0 text-gray-400 hover:text-white">
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <button onClick={onClose}
            className="w-full rounded-lg bg-gray-700 py-2 text-sm text-white hover:bg-gray-600">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">New API Key</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-gray-400" /></button>
        </div>
        <input placeholder="Key name (e.g. Axis Camera Lobby)" value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
        <div>
          <label className="text-xs text-gray-400 block mb-1">Expiry date (optional)</label>
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
        </div>
        {create.error && <p className="text-sm text-red-400">{create.error.message}</p>}
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 rounded-lg border border-gray-700 py-2 text-sm text-gray-300 hover:bg-gray-800">
            Cancel
          </button>
          <button
            onClick={() => create.mutate({ name, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined })}
            disabled={!name || create.isPending}
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 flex items-center justify-center gap-1">
            {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Generate Key
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function AlertsPage() {
  const { data: session } = useSession();
  const orgSlug = session?.user?.orgSlug ?? 'YOUR_ORG';
  const [tab, setTab] = useState<Tab>('active');

  // ---- Tab 1 state
  const [adHocTitle, setAdHocTitle] = useState('');
  const [adHocMessage, setAdHocMessage] = useState('');

  // ---- Tab 2 state
  const [templateModal, setTemplateModal] = useState<{ open: boolean; editId?: string; initial: TemplateFormState }>({
    open: false, initial: defaultTemplateForm(),
  });
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  // ---- Tab 3 state
  const [showNewKey, setShowNewKey] = useState(false);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);

  // ---- Queries / mutations
  const { data: alerts, refetch: refetchAlerts } = trpc.alerts.list.useQuery();
  const active = trpc.alerts.getActive.useQuery();
  const createAlert = trpc.alerts.create.useMutation({
    onSuccess: () => { refetchAlerts(); active.refetch(); setAdHocTitle(''); setAdHocMessage(''); },
  });
  const deactivate = trpc.alerts.deactivate.useMutation({
    onSuccess: () => { refetchAlerts(); active.refetch(); },
  });

  const { data: templates, refetch: refetchTemplates } = trpc.alertTemplates.list.useQuery();
  const triggerTemplate = trpc.alertTemplates.trigger.useMutation({
    onSuccess: () => { refetchAlerts(); active.refetch(); },
  });
  const deleteTemplate = trpc.alertTemplates.delete.useMutation({
    onSuccess: () => { refetchTemplates(); setDeleteTemplateId(null); },
  });

  const { data: apiKeys, refetch: refetchKeys } = trpc.apiKeys.list.useQuery();
  const revokeKey = trpc.apiKeys.revoke.useMutation({ onSuccess: () => refetchKeys() });
  const deleteKey = trpc.apiKeys.delete.useMutation({
    onSuccess: () => { refetchKeys(); setDeleteKeyId(null); },
  });

  const TABS: { id: Tab; label: string }[] = [
    { id: 'active', label: 'Active Alert' },
    { id: 'templates', label: 'Templates' },
    { id: 'apikeys', label: 'API Keys' },
  ];

  function keyStatus(k: { revokedAt: string | Date | null; expiresAt: string | Date | null }) {
    if (k.revokedAt) return { label: 'Revoked', cls: 'bg-red-900 text-red-300' };
    if (k.expiresAt && new Date(k.expiresAt) < new Date()) return { label: 'Expired', cls: 'bg-gray-700 text-gray-400' };
    return { label: 'Active', cls: 'bg-green-900 text-green-300' };
  }

  function fmtDate(d: string | Date | null | undefined) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString();
  }

  const exampleUrl = `https://YOUR-DOMAIN/api/v1/alerts/trigger?orgSlug=${orgSlug}&templateId=YOUR_TEMPLATE_ID&apiKey=YOUR_KEY`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Emergency Alerts</h1>
        {tab === 'templates' && (
          <button onClick={() => setTemplateModal({ open: true, initial: defaultTemplateForm() })}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500">
            <Plus className="h-4 w-4" /> New Template
          </button>
        )}
        {tab === 'apikeys' && (
          <button onClick={() => setShowNewKey(true)}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500">
            <Key className="h-4 w-4" /> New API Key
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1 w-fit">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tab 1: Active Alert                                                  */}
      {/* ------------------------------------------------------------------ */}
      {tab === 'active' && (
        <div className="space-y-4">
          {active.data?.isActive && (
            <div className="rounded-xl border border-red-800 bg-red-950/50 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-red-400">Active: {active.data.title}</p>
                <p className="text-sm text-red-300">{active.data.message}</p>
              </div>
              <button onClick={() => deactivate.mutate({ id: active.data!.id })}
                className="rounded-lg border border-red-700 px-3 py-1 text-sm text-red-400 hover:bg-red-900">
                Deactivate
              </button>
            </div>
          )}

          {/* Ad-hoc form */}
          {/* suppressHydrationWarning: browser password managers (e.g. Dashlane) inject data-* attrs into form elements */}
          <div suppressHydrationWarning className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-3">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" /> New Ad-hoc Alert
            </h2>
            <input suppressHydrationWarning placeholder="Alert title" value={adHocTitle} onChange={(e) => setAdHocTitle(e.target.value)}
              autoComplete="off" className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm" />
            <textarea suppressHydrationWarning placeholder="Alert message" value={adHocMessage} onChange={(e) => setAdHocMessage(e.target.value)}
              rows={3} className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm resize-none" />
            {createAlert.error && <p className="text-sm text-red-400">{createAlert.error.message}</p>}
            <button suppressHydrationWarning onClick={() => createAlert.mutate({ title: adHocTitle, message: adHocMessage })}
              disabled={!adHocTitle || !adHocMessage || createAlert.isPending}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50">
              {createAlert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {createAlert.isPending ? 'Sending…' : 'Broadcast'}
            </button>
          </div>

          {/* Alert history */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Alert History</h3>
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
            {alerts?.length === 0 && <p className="text-center text-gray-500 py-8">No alerts yet.</p>}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Tab 2: Templates                                                     */}
      {/* ------------------------------------------------------------------ */}
      {tab === 'templates' && (
        <div className="space-y-3">
          {templates?.map((t) => (
            <div key={t.id} className="rounded-xl border border-gray-800 bg-gray-900 p-4 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold text-white truncate">{t.name}</p>
                <p className="text-sm text-gray-400 truncate">{t.title} — {t.message}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {t.targetType === 'ALL' && (
                    <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">All Screens</span>
                  )}
                  {t.targetType === 'GROUPS' && (
                    <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">
                      Groups: {t.targetGroupIds.length}
                    </span>
                  )}
                  {t.targetType === 'SCREENS' && (
                    <span className="text-xs bg-purple-900 text-purple-300 px-2 py-0.5 rounded-full">
                      Screens: {t.targetScreenIds.length}
                    </span>
                  )}
                  {t.autoExpireMinutes && (
                    <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                      Auto-clears in {t.autoExpireMinutes}m
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => triggerTemplate.mutate({ id: t.id })}
                  disabled={triggerTemplate.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50">
                  {triggerTemplate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                  Trigger
                </button>
                <button
                  onClick={() => setTemplateModal({
                    open: true,
                    editId: t.id,
                    initial: {
                      name: t.name, title: t.title, message: t.message,
                      backgroundColor: t.backgroundColor, textColor: t.textColor,
                      targetType: t.targetType as 'ALL' | 'GROUPS' | 'SCREENS',
                      targetGroupIds: t.targetGroupIds, targetScreenIds: t.targetScreenIds,
                      autoExpireMinutes: t.autoExpireMinutes?.toString() ?? '',
                    },
                  })}
                  className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-gray-800">
                  <Edit2 className="h-4 w-4" />
                </button>
                <button onClick={() => setDeleteTemplateId(t.id)}
                  className="rounded-lg p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {templates?.length === 0 && (
            <p className="text-center text-gray-500 py-12">
              No templates yet. Create one to trigger alerts quickly.
            </p>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Tab 3: API Keys                                                      */}
      {/* ------------------------------------------------------------------ */}
      {tab === 'apikeys' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Key Prefix</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Created By</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Created</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Last Used</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Expires</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {apiKeys?.map((k) => {
                  const status = keyStatus(k);
                  const canRevoke = !k.revokedAt && !(k.expiresAt && new Date(k.expiresAt) < new Date());
                  return (
                    <tr key={k.id} className="hover:bg-gray-800/40">
                      <td className="px-4 py-3 text-white font-medium">{k.name}</td>
                      <td className="px-4 py-3 font-mono text-gray-300 text-xs">{k.keyPrefix}…</td>
                      <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{k.createdBy}</td>
                      <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{fmtDate(k.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{fmtDate(k.lastUsedAt)}</td>
                      <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{fmtDate(k.expiresAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs rounded-full px-2 py-0.5 ${status.cls}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {canRevoke && (
                            <button onClick={() => revokeKey.mutate({ id: k.id })}
                              disabled={revokeKey.isPending}
                              className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 px-2 py-1 rounded disabled:opacity-50">
                              Revoke
                            </button>
                          )}
                          <button onClick={() => setDeleteKeyId(k.id)}
                            className="text-gray-400 hover:text-red-400 p-1 rounded hover:bg-gray-700">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {apiKeys?.length === 0 && (
              <p className="text-center text-gray-500 py-10">No API keys yet.</p>
            )}
          </div>

          {/* Axis IO Setup Guide */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Key className="h-4 w-4 text-gray-400" /> Axis IO Setup Guide
            </h3>
            <p className="text-sm text-gray-400">
              Use the endpoint below to trigger an alert template from an Axis camera or other device:
            </p>
            <div className="flex items-start gap-2 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5">
              <code className="flex-1 text-xs text-green-400 font-mono break-all">{exampleUrl}</code>
              <button onClick={async () => { await copyText(exampleUrl); setUrlCopied(true); setTimeout(() => setUrlCopied(false), 2000); }}
                className="shrink-0 text-gray-400 hover:text-white mt-0.5">
                {urlCopied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-400">
              <li>Create an API key above and note its value.</li>
              <li>Create an Alert Template for the alert you want to trigger.</li>
              <li>Copy the <code className="text-gray-300 font-mono text-xs">templateId</code> from the template list.</li>
              <li>On your Axis device, go to <strong className="text-gray-300">System &rarr; Events &rarr; Rules</strong>.</li>
              <li>Add a new rule with Action <em className="text-gray-300">Send notification through HTTP</em>.</li>
              <li>Paste the URL above, replacing <code className="text-gray-300 font-mono text-xs">YOUR-DOMAIN</code>, <code className="text-gray-300 font-mono text-xs">YOUR_TEMPLATE_ID</code>, and <code className="text-gray-300 font-mono text-xs">YOUR_KEY</code>. The <code className="text-gray-300 font-mono text-xs">orgSlug</code> is already filled in.</li>
              <li>Set the method to <code className="text-gray-300 font-mono text-xs">POST</code> and save.</li>
            </ol>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modals                                                               */}
      {/* ------------------------------------------------------------------ */}
      {templateModal.open && (
        <TemplateModal
          editId={templateModal.editId}
          initial={templateModal.initial}
          onClose={() => setTemplateModal({ open: false, initial: defaultTemplateForm() })}
          onSaved={() => { refetchTemplates(); setTemplateModal({ open: false, initial: defaultTemplateForm() }); }}
        />
      )}

      {deleteTemplateId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-gray-700 bg-gray-900 p-6 space-y-4">
            <h2 className="text-white font-semibold">Delete template?</h2>
            <p className="text-sm text-gray-400">This template will be permanently deleted.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTemplateId(null)}
                className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800">
                Cancel
              </button>
              <button onClick={() => deleteTemplate.mutate({ id: deleteTemplateId })}
                disabled={deleteTemplate.isPending}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-50">
                {deleteTemplate.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewKey && (
        <NewKeyModal
          onClose={() => setShowNewKey(false)}
          onCreated={() => refetchKeys()}
        />
      )}

      {deleteKeyId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-gray-700 bg-gray-900 p-6 space-y-4">
            <h2 className="text-white font-semibold">Delete API key?</h2>
            <p className="text-sm text-gray-400">This key will stop working immediately and cannot be recovered.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteKeyId(null)}
                className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800">
                Cancel
              </button>
              <button onClick={() => deleteKey.mutate({ id: deleteKeyId })}
                disabled={deleteKey.isPending}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-50">
                {deleteKey.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
