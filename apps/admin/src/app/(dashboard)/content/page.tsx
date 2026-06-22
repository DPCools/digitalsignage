'use client';
import { useRef, useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { Upload, Loader2, Trash2, Globe, Camera, X, Plus, Eye } from 'lucide-react';
import { ContentPreviewModal } from '@/components/content/ContentPreviewModal';

type DeleteTarget = { ids: string[]; label: string };

// Explicit type to break deep tRPC/Prisma type recursion
type ContentItemRow = {
  id: string;
  name: string;
  type: string;
  url: string;
  thumbnailUrl: string | null;
  mimeType: string | null;
  fileSize: number | null;
  duration: number | null;
  status: string;
  createdAt: Date;
};

// ---------------------------------------------------------------------------
// WebPageModal
// ---------------------------------------------------------------------------
function WebPageModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [refreshInterval, setRefreshInterval] = useState('');
  const [duration, setDuration] = useState('30');

  const create = trpc.content.createWebPage.useMutation({ onSuccess: onSaved });

  function handleSubmit() {
    create.mutate({
      name,
      url,
      refreshInterval: refreshInterval ? parseInt(refreshInterval, 10) * 60 : null,
      duration: parseInt(duration, 10),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">Add Web Page</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-gray-400" /></button>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Display name <span className="text-red-400">*</span></label>
          <input
            placeholder="e.g. Company Dashboard"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">URL <span className="text-red-400">*</span></label>
          <input
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Auto-refresh interval (minutes, leave blank = never refresh)</label>
          <input
            type="number"
            min={1}
            placeholder="e.g. 5"
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(e.target.value)}
            className="w-32 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Duration per playlist slot (seconds) <span className="text-red-400">*</span></label>
          <input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-32 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm"
          />
        </div>

        {create.error && <p className="text-sm text-red-400">{create.error.message}</p>}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-700 py-2 text-sm text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name || !url || !duration || create.isPending}
            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Add Web Page
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CctvGridModal
// ---------------------------------------------------------------------------
type StreamRow = { url: string; label: string };

function CctvGridModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('30');
  const [streams, setStreams] = useState<StreamRow[]>([{ url: '', label: '' }]);

  const create = trpc.content.createCctvGrid.useMutation({ onSuccess: onSaved });

  function addStream() {
    if (streams.length < 4) {
      setStreams((prev) => [...prev, { url: '', label: '' }]);
    }
  }

  function removeStream(index: number) {
    setStreams((prev) => prev.filter((_, i) => i !== index));
  }

  function updateStream(index: number, field: keyof StreamRow, value: string) {
    setStreams((prev) => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }

  function handleSubmit() {
    create.mutate({
      name,
      streams: streams.filter((s) => s.url.trim()),
      duration: parseInt(duration, 10),
    });
  }

  const hasValidStream = streams.some((s) => s.url.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">Add CCTV Grid</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-gray-400" /></button>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Display name <span className="text-red-400">*</span></label>
          <input
            placeholder="e.g. Reception Cameras"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Duration per playlist slot (seconds) <span className="text-red-400">*</span></label>
          <input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-32 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm"
          />
        </div>

        {/* Stream rows */}
        <div className="space-y-3">
          <span className="text-xs text-gray-400 block">Camera streams (up to 4)</span>
          {streams.map((stream, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1 space-y-1.5">
                <input
                  placeholder="Stream URL (http:// or rtsp://user:pass@IP:554/...)"
                  value={stream.url}
                  onChange={(e) => updateStream(index, 'url', e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm"
                />
                <input
                  placeholder="Label (optional, shown in grid overlay)"
                  value={stream.label}
                  onChange={(e) => updateStream(index, 'label', e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm"
                />
              </div>
              {streams.length > 1 && (
                <button
                  onClick={() => removeStream(index)}
                  className="shrink-0 rounded p-1.5 text-gray-600 hover:text-red-400 hover:bg-gray-800 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {streams.length < 4 && (
            <button
              onClick={addStream}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <Plus className="h-4 w-4" /> Add stream
            </button>
          )}
        </div>

        {/* Brand URL hints */}
        <div className="rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 space-y-1.5">
          <p className="text-xs font-medium text-gray-300">Common stream URL formats</p>
          <p className="text-xs text-gray-500"><span className="text-gray-400">Axis (MJPEG):</span> http://user:pass@IP/axis-cgi/mjpg/video.cgi</p>
          <p className="text-xs text-gray-500"><span className="text-gray-400">Hikvision (RTSP):</span> rtsp://user:pass@IP:554/ISAPI/Streaming/channels/101</p>
          <p className="text-xs text-gray-500"><span className="text-gray-400">Dahua (MJPEG):</span> http://user:pass@IP/cgi-bin/mjpg/video.cgi</p>
        </div>

        {create.error && <p className="text-sm text-red-400">{create.error.message}</p>}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-700 py-2 text-sm text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name || !duration || !hasValidStream || create.isPending}
            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Add CCTV Grid
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContentPage
// ---------------------------------------------------------------------------
export default function ContentPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showWebPageModal, setShowWebPageModal] = useState(false);
  const [showCctvModal, setShowCctvModal] = useState(false);
  const [previewItem, setPreviewItem] = useState<ContentItemRow | null>(null);

  const { data, refetch } = trpc.content.list.useQuery({}, {
    refetchInterval: (query: { state: { data?: { items: Array<{ type: string; url: string }> } } }) =>
      query.state.data?.items.some((i) => i.type === 'VIDEO' && !i.url.includes('-tc.mp4'))
        ? 3000
        : false,
  });
  const getUploadUrl = trpc.content.getUploadUrl.useMutation();
  const confirmUpload = trpc.content.confirmUpload.useMutation({ onSuccess: () => refetch() });
  const deleteItem = trpc.content.delete.useMutation();

  // Some browsers (especially on Windows) report video files as application/octet-stream.
  // Infer from the extension client-side so the server allowlist isn't bypassed.
  function resolveMime(file: File): string {
    if (file.type && file.type !== 'application/octet-stream') return file.type;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const byExt: Record<string, string> = {
      mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
      mkv: 'video/x-matroska', wmv: 'video/x-ms-wmv', mpeg: 'video/mpeg',
      mpg: 'video/mpeg', '3gp': 'video/3gpp', flv: 'video/x-flv',
      webm: 'video/webm', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
      pdf: 'application/pdf',
    };
    return byExt[ext] ?? file.type;
  }

  async function handleFile(file: File) {
    setUploadError('');
    setUploading(true);
    try {
      const { url, key } = await getUploadUrl.mutateAsync({
        filename: file.name,
        mimeType: resolveMime(file),
        size: file.size,
      });
      const mimeType = resolveMime(file);
      await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': mimeType } });
      await confirmUpload.mutateAsync({ name: file.name, key, mimeType, fileSize: file.size });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await Promise.all(deleteTarget.ids.map((id) => deleteItem.mutateAsync({ id })));
      setSelected(new Set());
      setDeleteTarget(null);
      refetch();
    } finally {
      setDeleting(false);
    }
  }

  const items = (data?.items ?? []) as unknown as ContentItemRow[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Content Library</h1>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={() => setDeleteTarget({
                ids: [...selected],
                label: `${selected.size} item${selected.size > 1 ? 's' : ''}`,
              })}
              className="flex items-center gap-2 rounded-lg bg-red-700 hover:bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete {selected.size} selected
            </button>
          )}
          <button
            onClick={() => setShowWebPageModal(true)}
            className="flex items-center gap-2 rounded-lg bg-gray-700 hover:bg-gray-600 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            <Globe className="h-4 w-4" />
            Add Web Page
          </button>
          <button
            onClick={() => setShowCctvModal(true)}
            className="flex items-center gap-2 rounded-lg bg-gray-700 hover:bg-gray-600 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            <Camera className="h-4 w-4" />
            Add CCTV
          </button>
          <label className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 cursor-pointer transition-colors">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? 'Uploading…' : 'Upload'}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,video/x-ms-wmv,video/mpeg,video/3gpp,video/x-flv,application/pdf"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        </div>
      </div>

      {uploadError && <p className="text-sm text-red-400">{uploadError}</p>}

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((item) => {
          const isProcessing = item.type === 'VIDEO' && !item.url.includes('-tc.mp4');
          const isSelected = selected.has(item.id);

          return (
            <div
              key={item.id}
              onClick={() => toggleSelect(item.id)}
              className={`group rounded-xl border bg-gray-900 overflow-hidden cursor-pointer transition-colors ${
                isSelected ? 'border-blue-500' : 'border-gray-800 hover:border-gray-600'
              }`}
            >
              {/* Preview */}
              <div className="aspect-video bg-black relative overflow-hidden">
                {item.type === 'IMAGE' && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={item.name} className="w-full h-full object-contain" />
                )}
                {item.type === 'VIDEO' && (
                  <video
                    src={item.url}
                    className="w-full h-full object-contain"
                    controls
                    muted
                    preload="metadata"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                {item.type !== 'IMAGE' && item.type !== 'VIDEO' && (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">
                      {item.type.replace('_', ' ')}
                    </span>
                  </div>
                )}

                {/* Processing badge */}
                {isProcessing && (
                  <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 pointer-events-none">
                    <Loader2 className="h-3 w-3 animate-spin text-yellow-400" />
                    <span className="text-[10px] text-yellow-400">Processing…</span>
                  </div>
                )}

                {/* Selection checkbox */}
                <div className={`absolute top-1.5 right-1.5 h-5 w-5 rounded border-2 flex items-center justify-center transition-opacity pointer-events-none ${
                  isSelected
                    ? 'opacity-100 bg-blue-500 border-blue-500'
                    : 'opacity-0 group-hover:opacity-100 bg-black/50 border-gray-400'
                }`}>
                  {isSelected && (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-2 flex items-center justify-between gap-1">
                <div className="min-w-0">
                  <p className="text-xs text-white truncate">{item.name}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {item.type.toLowerCase().replace('_', ' ')}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPreviewItem(item); }}
                    title="Preview"
                    className="rounded p-1 text-gray-600 hover:text-blue-400 hover:bg-gray-800 transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({ ids: [item.id], label: `"${item.name}"` });
                    }}
                    title="Delete"
                    className="rounded p-1 text-gray-600 hover:text-red-400 hover:bg-gray-800 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <p className="col-span-full text-center text-gray-500 py-12">
            No content yet. Upload some files to get started.
          </p>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="rounded-xl bg-gray-900 border border-gray-700 p-6 w-full max-w-sm space-y-4 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-white font-semibold text-lg">Delete content?</h2>
            <p className="text-sm text-gray-400">
              {deleteTarget.label} will be permanently deleted and cannot be recovered.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-40"
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Web Page modal */}
      {showWebPageModal && (
        <WebPageModal
          onClose={() => setShowWebPageModal(false)}
          onSaved={() => { refetch(); setShowWebPageModal(false); }}
        />
      )}

      {/* CCTV Grid modal */}
      {showCctvModal && (
        <CctvGridModal
          onClose={() => setShowCctvModal(false)}
          onSaved={() => { refetch(); setShowCctvModal(false); }}
        />
      )}

      {/* Content preview modal */}
      {previewItem && (
        <ContentPreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
}
