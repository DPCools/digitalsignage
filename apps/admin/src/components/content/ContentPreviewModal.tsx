'use client';
import { X, ExternalLink, Video, Globe, Camera, FileText, Image as ImageIcon } from 'lucide-react';

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

function fmtBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 ** 2)   return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)   return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function fmtDuration(s: number | null): string {
  if (!s) return '—';
  if (s < 60)  return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function fmtType(type: string): string {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    APPROVED: 'bg-green-500/15 text-green-400',
    PENDING:  'bg-yellow-500/15 text-yellow-400',
    REJECTED: 'bg-red-500/15 text-red-400',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? 'bg-gray-700 text-gray-400'}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function PreviewArea({ item }: { item: ContentItemRow }) {
  if (item.type === 'IMAGE') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.url}
        alt={item.name}
        className="max-h-[60vh] max-w-full mx-auto object-contain rounded-lg"
      />
    );
  }

  if (item.type === 'VIDEO') {
    return (
      <video
        src={item.url}
        controls
        className="max-h-[60vh] max-w-full mx-auto rounded-lg"
        style={{ aspectRatio: '16/9' }}
      />
    );
  }

  if (item.type === 'PDF') {
    return (
      <div className="w-full h-[60vh] rounded-lg overflow-hidden border border-gray-700">
        <embed src={item.url} type="application/pdf" width="100%" height="100%" />
      </div>
    );
  }

  if (item.type === 'WEB_PAGE') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10">
        <Globe className="w-14 h-14 text-gray-600" />
        <p className="text-sm text-gray-400 break-all max-w-sm text-center">{item.url}</p>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          Open in new tab <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    );
  }

  if (item.type === 'CCTV_GRID') {
    let streams: Array<{ label?: string }> = [];
    try {
      const meta = JSON.parse(JSON.stringify(item)) as { metadata?: { streams?: Array<{ label?: string }> } };
      streams = (meta as { streams?: Array<{ label?: string }> }).streams ?? [];
    } catch { /* ignore */ }

    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10">
        <Camera className="w-14 h-14 text-gray-600" />
        <p className="text-sm text-gray-400">
          {streams.length || '—'} camera stream{streams.length !== 1 ? 's' : ''} configured
        </p>
        {streams.length > 0 && (
          <ul className="space-y-1">
            {streams.map((s, i) => (
              <li key={i} className="text-xs text-gray-500">
                Camera {i + 1}{s.label ? ` — ${s.label}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (item.type === 'HTML_TEMPLATE') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10">
        <FileText className="w-14 h-14 text-gray-600" />
        <p className="text-sm text-gray-400">HTML Template</p>
        {item.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt={item.name}
            className="max-h-48 rounded-lg border border-gray-700"
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <ImageIcon className="w-14 h-14 text-gray-600" />
      <p className="text-sm text-gray-400">No preview available for {fmtType(item.type)}</p>
    </div>
  );
}

export function ContentPreviewModal({
  item,
  onClose,
}: {
  item: ContentItemRow;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-xl border border-gray-700 bg-gray-900 overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-semibold text-white truncate" title={item.name}>{item.name}</h2>
            <span className="shrink-0 text-xs text-gray-500 border border-gray-700 rounded px-1.5 py-0.5">
              {fmtType(item.type)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 ml-4 rounded p-1 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview */}
        <div className="p-5 bg-black/30 min-h-32">
          <PreviewArea item={item} />
        </div>

        {/* Metadata strip */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 border-t border-gray-800 text-xs text-gray-400">
          <span>Status: <StatusBadge status={item.status} /></span>
          <span>Duration: <span className="text-gray-300">{fmtDuration(item.duration)}</span></span>
          <span>Size: <span className="text-gray-300">{fmtBytes(item.fileSize)}</span></span>
          <span>Added: <span className="text-gray-300">{new Date(item.createdAt).toLocaleDateString()}</span></span>
          {item.mimeType && (
            <span>Format: <span className="text-gray-300">{item.mimeType}</span></span>
          )}
        </div>
      </div>
    </div>
  );
}
