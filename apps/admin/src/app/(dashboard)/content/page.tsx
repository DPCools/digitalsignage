'use client';
import { useRef, useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { Upload, Loader2, Trash2 } from 'lucide-react';

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

export default function ContentPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget({ ids: [item.id], label: `"${item.name}"` });
                  }}
                  title="Delete"
                  className="shrink-0 rounded p-1 text-gray-600 hover:text-red-400 hover:bg-gray-800 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
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
    </div>
  );
}
