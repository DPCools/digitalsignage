'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { Plus, Trash2, Pencil, Code2, Clock, FileCode } from 'lucide-react';
import Link from 'next/link';

type TemplateRow = {
  id: string;
  name: string;
  html: string;
  createdAt: Date;
  variables: unknown;
};

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function varCount(variables: unknown): number {
  if (!Array.isArray(variables)) return 0;
  return variables.length;
}

export default function TemplatesPage() {
  const router = useRouter();
  const { data: templates, refetch, isLoading } = trpc.templates.list.useQuery();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const createMut = trpc.templates.create.useMutation({
    onSuccess: (t) => {
      setCreating(false);
      setNewName('');
      router.push(`/content/templates/${t.id}`);
    },
  });

  const deleteMut = trpc.templates.delete.useMutation({
    onSuccess: () => { refetch(); setDeleteId(null); },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">HTML Templates</h1>
          <p className="text-sm text-gray-400 mt-1">
            Reusable HTML/CSS layouts with variable placeholders for dynamic content
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Template
        </button>
      </div>

      {/* Template grid */}
      {isLoading ? (
        <p className="text-gray-500 text-sm py-12 text-center">Loading…</p>
      ) : (templates?.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-800 py-20 gap-3">
          <FileCode className="h-10 w-10 text-gray-700" />
          <p className="text-gray-500 text-sm">No templates yet.</p>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create your first template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(templates as TemplateRow[])?.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden hover:border-gray-700 transition-colors"
            >
              {/* Mini preview */}
              <div className="h-32 bg-gray-950 flex items-center justify-center border-b border-gray-800 relative overflow-hidden">
                <iframe
                  srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0a0a0a;color:#fff;font-family:sans-serif;font-size:10px;overflow:hidden;width:320px;height:128px;display:flex;align-items:center;justify-content:center}</style></head><body>${t.html.slice(0, 500)}</body></html>`}
                  sandbox="allow-same-origin"
                  className="w-full h-full border-0 pointer-events-none"
                  title="Template preview"
                />
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">{t.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Code2 className="h-3 w-3" />
                        {varCount(t.variables)} variable{varCount(t.variables) !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        {formatDate(t.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link
                      href={`/content/templates/${t.id}`}
                      className="rounded p-1.5 text-gray-500 hover:text-blue-400 hover:bg-gray-800 transition-colors"
                      title="Edit template"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      onClick={() => setDeleteId(t.id)}
                      className="rounded p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors"
                      title="Delete template"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {creating && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setCreating(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-white">New Template</h2>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Template name</label>
              <input
                autoFocus
                placeholder="e.g. Sales Dashboard"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newName.trim()) {
                    createMut.mutate({ name: newName.trim(), html: '<div style="padding:2rem;text-align:center"><h1>{{title}}</h1><p>{{message}}</p></div>' });
                  }
                }}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            {createMut.error && (
              <p className="text-xs text-red-400">{createMut.error.message}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setCreating(false)}
                className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newName.trim()) {
                    createMut.mutate({ name: newName.trim(), html: '<div style="padding:2rem;text-align:center"><h1>{{title}}</h1><p>{{message}}</p></div>' });
                  }
                }}
                disabled={!newName.trim() || createMut.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {createMut.isPending ? 'Creating…' : 'Create & Edit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDeleteId(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-white">Delete template?</h2>
            <p className="text-sm text-gray-400">
              This will permanently delete the template. Any content items using it will stop rendering.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate({ id: deleteId })}
                disabled={deleteMut.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
              >
                {deleteMut.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
