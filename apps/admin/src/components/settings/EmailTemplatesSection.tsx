'use client';
import { useRef, useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { Mail, Loader2, Send, Check } from 'lucide-react';
import { EMAIL_EVENTS, EMAIL_EVENT_MAP, type EmailEvent } from '@/lib/email-events';

interface TemplateRow {
  event: string;
  enabled: boolean;
  subject: string;
  bodyHtml: string;
  recipientListIds: string[];
}

const field = 'w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none placeholder:text-gray-600';

function TemplateCard({
  row,
  lists,
}: {
  row: TemplateRow;
  lists: { id: string; name: string }[];
}) {
  const def = EMAIL_EVENT_MAP[row.event as EmailEvent];
  const utils = trpc.useUtils();
  const update = trpc.emailTemplates.update.useMutation({ onSuccess: () => utils.emailTemplates.getAll.invalidate() });
  const sendTest = trpc.emailTemplates.sendTest.useMutation();

  const [enabled, setEnabled] = useState(row.enabled);
  const [subject, setSubject] = useState(row.subject);
  const [body, setBody] = useState(row.bodyHtml);
  const [listIds, setListIds] = useState<string[]>(row.recipientListIds);
  const [testTo, setTestTo] = useState('');
  const [testOpen, setTestOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const dirty =
    enabled !== row.enabled ||
    subject !== row.subject ||
    body !== row.bodyHtml ||
    JSON.stringify(listIds) !== JSON.stringify(row.recipientListIds);

  function insertPlaceholder(key: string) {
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    if (!el) { setBody((b) => b + token); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    // restore caret just after the inserted token
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function save() {
    update.mutate(
      { event: row.event as EmailEvent, enabled, subject, bodyHtml: body, recipientListIds: listIds },
      { onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000); } }
    );
  }

  function toggleList(id: string) {
    setListIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="px-6 py-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">{def.label}</p>
          <p className="text-xs text-gray-500">{def.description}</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-gray-600 bg-gray-800 text-blue-500"
          />
          <span className="text-xs text-gray-400">{enabled ? 'Enabled' : 'Disabled'}</span>
        </label>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-gray-500">Subject</label>
        <input className={field} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-gray-500">Body (HTML)</label>
        <textarea
          ref={bodyRef}
          className={`${field} h-40 resize-y font-mono text-xs`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {def.placeholders.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => insertPlaceholder(p.key)}
              title={`Insert {{${p.key}}}`}
              className="rounded-full bg-gray-800 hover:bg-gray-700 border border-gray-700 px-2 py-0.5 text-xs text-gray-300 hover:text-white transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {def.hasListRecipients && (
        <div className="space-y-1">
          <label className="text-xs text-gray-500">Recipient lists</label>
          {lists.length === 0 ? (
            <p className="text-xs text-gray-600">No recipient lists yet — create one above.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {lists.map((l) => {
                const on = listIds.includes(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => toggleList(l.id)}
                    className={`rounded-full px-2.5 py-0.5 text-xs border transition-colors ${
                      on ? 'border-blue-500 bg-blue-600/20 text-blue-300' : 'border-gray-700 bg-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {l.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          {testOpen ? (
            <>
              <input
                className={`${field} w-56`}
                placeholder="you@company.com"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
              <button
                onClick={() => sendTest.mutate(
                  { event: row.event as EmailEvent, subject, bodyHtml: body, to: testTo.trim() },
                  { onSuccess: () => setTestOpen(false) }
                )}
                disabled={!testTo.trim() || sendTest.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-medium text-gray-300 hover:text-white disabled:opacity-40 transition-colors"
              >
                {sendTest.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send
              </button>
              <button onClick={() => setTestOpen(false)} className="text-xs text-gray-500 hover:text-white">Cancel</button>
            </>
          ) : (
            <button
              onClick={() => setTestOpen(true)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              Send test
            </button>
          )}
          {sendTest.error && <span className="text-xs text-red-400">{sendTest.error.message}</span>}
        </div>

        <div className="flex items-center gap-3">
          {saved && <span className="flex items-center gap-1 text-xs text-green-400"><Check className="w-3.5 h-3.5" /> Saved</span>}
          {update.error && <span className="text-xs text-red-400">{update.error.message}</span>}
          <button
            onClick={save}
            disabled={!dirty || update.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EmailTemplatesSection() {
  const { data: templates } = trpc.emailTemplates.getAll.useQuery();
  const { data: lists } = trpc.recipientLists.list.useQuery();

  // Render in the canonical event order regardless of DB row order.
  const ordered = EMAIL_EVENTS.map((def) => templates?.find((t) => t.event === def.event)).filter(
    (t): t is NonNullable<typeof t> => Boolean(t)
  );

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900 divide-y divide-gray-800">
      <div className="px-6 py-4 flex items-center gap-2">
        <Mail className="w-4 h-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Email Templates</h2>
      </div>

      {!templates ? (
        <div className="px-6 py-8 text-sm text-gray-500">Loading…</div>
      ) : (
        ordered.map((row) => (
          <TemplateCard key={row.event} row={row} lists={(lists ?? []).map((l) => ({ id: l.id, name: l.name }))} />
        ))
      )}
    </section>
  );
}
