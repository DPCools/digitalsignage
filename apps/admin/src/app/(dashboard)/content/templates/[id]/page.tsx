'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import {
  Save, ArrowLeft, Plus, Trash2, Play, Check, Loader2,
  Eye, Code2, Palette, Variable,
} from 'lucide-react';
import Link from 'next/link';

type VarType = 'text' | 'image' | 'color' | 'number';

type TemplateVariable = {
  name: string;
  type: VarType;
  default: string;
};

type SaveState = 'idle' | 'saving' | 'saved';

const VAR_TYPE_LABELS: Record<VarType, string> = {
  text: 'Text',
  image: 'Image URL',
  color: 'Color',
  number: 'Number',
};

const DEFAULT_HTML = `<div class="slide">
  <h1>{{title}}</h1>
  <p>{{message}}</p>
</div>`;

const DEFAULT_CSS = `body {
  margin: 0;
  padding: 2rem;
  background: #111827;
  color: #f9fafb;
  font-family: sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  box-sizing: border-box;
}

.slide {
  text-align: center;
  max-width: 800px;
}

h1 {
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: #60a5fa;
}

p {
  font-size: 1.5rem;
  color: #9ca3af;
}`;

function buildSrcDoc(html: string, css: string, vars: TemplateVariable[]): string {
  let rendered = html;
  for (const v of vars) {
    rendered = rendered.replaceAll(`{{${v.name}}}`, v.default || `[${v.name}]`);
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${rendered}</body></html>`;
}

export default function TemplateEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { data: template, isLoading } = trpc.templates.get.useQuery({ id: params.id });
  const updateMut = trpc.templates.update.useMutation();
  const instantiateMut = trpc.templates.instantiate.useMutation({
    onSuccess: () => {
      setInstantiating(false);
      router.push('/content');
    },
  });

  const [name, setName] = useState('');
  const [html, setHtml] = useState('');
  const [css, setCss] = useState('');
  const [vars, setVars] = useState<TemplateVariable[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [activeTab, setActiveTab] = useState<'html' | 'css' | 'vars'>('html');
  const [previewKey, setPreviewKey] = useState(0);

  const [instantiating, setInstantiating] = useState(false);
  const [instName, setInstName] = useState('');
  const [instVarValues, setInstVarValues] = useState<Record<string, string>>({});

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load template data once fetched
  useEffect(() => {
    if (!template) return;
    setName(template.name);
    setHtml(template.html || DEFAULT_HTML);
    setCss(template.css || DEFAULT_CSS);
    const rawVars = Array.isArray(template.variables) ? template.variables : [];
    setVars(rawVars.map((v: unknown) => {
      const vv = v as Partial<TemplateVariable>;
      return { name: vv.name ?? '', type: (vv.type ?? 'text') as VarType, default: String(vv.default ?? '') };
    }));
  }, [template]);

  const triggerSave = useCallback((
    nextHtml: string, nextCss: string, nextVars: TemplateVariable[], nextName: string
  ) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(async () => {
      try {
        await updateMut.mutateAsync({
          id: params.id,
          name: nextName,
          html: nextHtml,
          css: nextCss,
          variables: nextVars,
        });
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2000);
      } catch {
        setSaveState('idle');
      }
    }, 800);
  }, [params.id, updateMut]);

  function handleHtmlChange(v: string) {
    setHtml(v);
    triggerSave(v, css, vars, name);
  }

  function handleCssChange(v: string) {
    setCss(v);
    triggerSave(html, v, vars, name);
  }

  function handleNameChange(v: string) {
    setName(v);
    triggerSave(html, css, vars, v);
  }

  function handleVarChange(idx: number, field: keyof TemplateVariable, value: string) {
    const next = vars.map((v, i) => i === idx ? { ...v, [field]: value } : v);
    setVars(next);
    triggerSave(html, css, next, name);
  }

  function addVar() {
    const next = [...vars, { name: 'variable', type: 'text' as VarType, default: '' }];
    setVars(next);
    triggerSave(html, css, next, name);
  }

  function removeVar(idx: number) {
    const next = vars.filter((_, i) => i !== idx);
    setVars(next);
    triggerSave(html, css, next, name);
  }

  function refreshPreview() {
    setPreviewKey((k) => k + 1);
  }

  function openInstantiate() {
    setInstName(template?.name ? `${template.name} — instance` : '');
    const defaults: Record<string, string> = {};
    for (const v of vars) defaults[v.name] = v.default;
    setInstVarValues(defaults);
    setInstantiating(true);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 text-gray-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] gap-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 py-3 px-0 border-b border-gray-800 shrink-0">
        <Link
          href="/content/templates"
          className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Templates
        </Link>

        <div className="h-5 w-px bg-gray-800" />

        <input
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none w-64"
          placeholder="Template name"
        />

        <div className="flex-1" />

        {/* Save indicator */}
        <div className="flex items-center gap-1.5 text-xs">
          {saveState === 'saving' && (
            <>
              <Loader2 className="h-3 w-3 text-gray-500 animate-spin" />
              <span className="text-gray-500">Saving…</span>
            </>
          )}
          {saveState === 'saved' && (
            <>
              <Check className="h-3 w-3 text-green-500" />
              <span className="text-green-500">Saved</span>
            </>
          )}
        </div>

        <button
          onClick={refreshPreview}
          className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <Play className="h-3.5 w-3.5" />
          Refresh preview
        </button>

        <button
          onClick={openInstantiate}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Use as content
        </button>
      </div>

      {/* Main two-pane layout */}
      <div className="flex flex-1 min-h-0 gap-0">
        {/* Editor pane */}
        <div className="w-1/2 flex flex-col border-r border-gray-800">
          {/* Tab bar */}
          <div className="flex border-b border-gray-800 shrink-0">
            {([
              { id: 'html', label: 'HTML', icon: Code2 },
              { id: 'css', label: 'CSS', icon: Palette },
              { id: 'vars', label: `Variables (${vars.length})`, icon: Variable },
            ] as { id: 'html' | 'css' | 'vars'; label: string; icon: typeof Code2 }[]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === id
                    ? 'border-blue-500 text-white'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Editor area */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === 'html' && (
              <textarea
                value={html}
                onChange={(e) => handleHtmlChange(e.target.value)}
                spellCheck={false}
                className="w-full h-full resize-none bg-gray-950 text-gray-200 text-xs font-mono p-4 focus:outline-none border-0"
                placeholder="Enter HTML here. Use {{variable}} for placeholders."
              />
            )}

            {activeTab === 'css' && (
              <textarea
                value={css}
                onChange={(e) => handleCssChange(e.target.value)}
                spellCheck={false}
                className="w-full h-full resize-none bg-gray-950 text-gray-200 text-xs font-mono p-4 focus:outline-none border-0"
                placeholder="Enter CSS here."
              />
            )}

            {activeTab === 'vars' && (
              <div className="h-full overflow-y-auto p-4 space-y-3">
                <p className="text-xs text-gray-500">
                  Define variables used in your template. Reference them with <code className="text-blue-400 bg-gray-900 px-1 rounded">{'{{name}}'}</code>.
                  Default values are shown in the preview.
                </p>
                {vars.map((v, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-gray-800 bg-gray-900 p-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <input
                          value={v.name}
                          onChange={(e) => handleVarChange(i, 'name', e.target.value)}
                          placeholder="variable_name"
                          className="flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white font-mono placeholder-gray-600 focus:border-blue-500 focus:outline-none"
                        />
                        <select
                          value={v.type}
                          onChange={(e) => handleVarChange(i, 'type', e.target.value)}
                          className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
                        >
                          {Object.entries(VAR_TYPE_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <input
                        value={v.default}
                        onChange={(e) => handleVarChange(i, 'default', e.target.value)}
                        placeholder="Default value (shown in preview)"
                        className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={() => removeVar(i)}
                      className="mt-1 text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addVar}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-400 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add variable
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Preview pane */}
        <div className="w-1/2 flex flex-col">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 shrink-0">
            <Eye className="h-3.5 w-3.5 text-gray-500" />
            <span className="text-xs text-gray-500">Live Preview</span>
            <span className="text-xs text-gray-700">(using variable defaults)</span>
          </div>
          <div className="flex-1 bg-gray-950">
            <iframe
              key={previewKey}
              srcDoc={buildSrcDoc(html, css, vars)}
              sandbox="allow-same-origin allow-scripts"
              className="w-full h-full border-0"
              title="Template preview"
            />
          </div>
        </div>
      </div>

      {/* Instantiate modal */}
      {instantiating && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setInstantiating(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-white">Add to Content Library</h2>
            <p className="text-sm text-gray-400">
              Creates a content item from this template. Fill in the variable values, then add it to a playlist.
            </p>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Content item name</label>
              <input
                value={instName}
                onChange={(e) => setInstName(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                placeholder="e.g. Q4 Sales Slide"
              />
            </div>

            {vars.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Variable values</p>
                {vars.map((v) => (
                  <div key={v.name}>
                    <label className="text-xs text-gray-400 block mb-1">
                      <code className="text-blue-400">{'{{' + v.name + '}}'}</code>
                      <span className="ml-1 text-gray-600">({VAR_TYPE_LABELS[v.type]})</span>
                    </label>
                    {v.type === 'color' ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={instVarValues[v.name] ?? v.default ?? '#2563eb'}
                          onChange={(e) => setInstVarValues((prev) => ({ ...prev, [v.name]: e.target.value }))}
                          className="h-8 w-12 rounded cursor-pointer border-0 bg-transparent"
                        />
                        <input
                          value={instVarValues[v.name] ?? v.default ?? ''}
                          onChange={(e) => setInstVarValues((prev) => ({ ...prev, [v.name]: e.target.value }))}
                          className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white font-mono focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    ) : (
                      <input
                        type={v.type === 'number' ? 'number' : 'text'}
                        value={instVarValues[v.name] ?? v.default ?? ''}
                        onChange={(e) => setInstVarValues((prev) => ({ ...prev, [v.name]: e.target.value }))}
                        placeholder={v.default || `Enter ${v.name}`}
                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {instantiateMut.error && (
              <p className="text-xs text-red-400">{instantiateMut.error.message}</p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setInstantiating(false)}
                className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!instName.trim()) return;
                  instantiateMut.mutate({
                    templateId: params.id,
                    name: instName.trim(),
                    variableValues: instVarValues,
                  });
                }}
                disabled={!instName.trim() || instantiateMut.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {instantiateMut.isPending ? 'Adding…' : 'Add to library'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
