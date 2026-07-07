'use client';
import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { Users, Plus, Pencil, Trash2 } from 'lucide-react';
import { ConfirmButton } from '@/components/ui/ConfirmButton';

// Splits a free-text field of addresses (comma / semicolon / newline / space
// separated) into a clean, deduped array.
function parseEmails(raw: string): string[] {
  return [...new Set(raw.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean))];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ListEditor({
  initialName,
  initialEmails,
  pending,
  error,
  onCancel,
  onSave,
}: {
  initialName: string;
  initialEmails: string[];
  pending: boolean;
  error?: string | null;
  onCancel: () => void;
  onSave: (name: string, emails: string[]) => void;
}) {
  const [name, setName] = useState(initialName);
  const [emailsText, setEmailsText] = useState(initialEmails.join(', '));

  const parsed = parseEmails(emailsText);
  const invalid = parsed.filter((e) => !EMAIL_RE.test(e));
  const canSave = name.trim().length > 0 && parsed.length > 0 && invalid.length === 0 && !pending;

  const field = 'w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none placeholder:text-gray-600';

  return (
    <div className="space-y-2 rounded-lg border border-gray-800 p-3">
      <input
        className={field}
        placeholder="List name (e.g. Site Managers)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <textarea
        className={`${field} h-24 resize-y font-mono text-xs`}
        placeholder="Email addresses, separated by commas or new lines"
        value={emailsText}
        onChange={(e) => setEmailsText(e.target.value)}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {parsed.length} address{parsed.length !== 1 ? 'es' : ''}
          {invalid.length > 0 && <span className="text-red-400"> · {invalid.length} invalid</span>}
        </p>
        {invalid.length > 0 && (
          <p className="text-xs text-red-400 truncate max-w-[60%]">Invalid: {invalid.join(', ')}</p>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} disabled={pending} className="text-sm text-gray-400 hover:text-white px-3 py-1.5 disabled:opacity-50">
          Cancel
        </button>
        <button
          onClick={() => onSave(name.trim(), parsed)}
          disabled={!canSave}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save list'}
        </button>
      </div>
    </div>
  );
}

export function RecipientListsSection() {
  const { data: lists, refetch } = trpc.recipientLists.list.useQuery();
  const create = trpc.recipientLists.create.useMutation({ onSuccess: () => { refetch(); setAdding(false); } });
  const update = trpc.recipientLists.update.useMutation({ onSuccess: () => { refetch(); setEditingId(null); } });
  const remove = trpc.recipientLists.delete.useMutation({ onSuccess: () => refetch() });

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900 divide-y divide-gray-800">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Recipient Lists</h2>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New list
          </button>
        )}
      </div>

      <div className="px-6 py-4 space-y-3">
        <p className="text-xs text-gray-500">
          Named groups of email addresses. Assign them to alerts and to the screen-offline notification.
        </p>

        {adding && (
          <ListEditor
            initialName=""
            initialEmails={[]}
            pending={create.isPending}
            error={create.error?.message}
            onCancel={() => setAdding(false)}
            onSave={(name, emails) => create.mutate({ name, emails })}
          />
        )}

        {(lists ?? []).length === 0 && !adding && (
          <p className="text-sm text-gray-500 py-4 text-center">No recipient lists yet.</p>
        )}

        {(lists ?? []).map((l) =>
          editingId === l.id ? (
            <ListEditor
              key={l.id}
              initialName={l.name}
              initialEmails={l.emails}
              pending={update.isPending}
              error={update.error?.message}
              onCancel={() => setEditingId(null)}
              onSave={(name, emails) => update.mutate({ id: l.id, name, emails })}
            />
          ) : (
            <div key={l.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-800 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{l.name}</p>
                <p className="text-xs text-gray-500 truncate">{l.emails.length} address{l.emails.length !== 1 ? 'es' : ''} · {l.emails.join(', ')}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setEditingId(l.id)} className="text-gray-500 hover:text-white transition-colors">
                  <Pencil className="h-4 w-4" />
                </button>
                <ConfirmButton
                  onConfirm={() => remove.mutate({ id: l.id })}
                  pending={remove.isPending}
                  error={remove.error?.message}
                  title="Delete recipient list?"
                  message={<>Delete <span className="font-medium text-white">{l.name}</span>? Alerts and templates using it will simply stop emailing it.</>}
                  triggerAriaLabel="Delete recipient list"
                  triggerClassName="text-gray-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </ConfirmButton>
              </div>
            </div>
          )
        )}
      </div>
    </section>
  );
}
