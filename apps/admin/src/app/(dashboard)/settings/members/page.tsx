'use client';
import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { UserPlus, Trash2, Copy, Check, Shield, Clock } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  action: string;
  actorId: string | null;
  actorName: string | null;
  targetId: string | null;
  targetName: string | null;
  metadata: unknown;
  createdAt: Date;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Owner',
  ADMIN: 'Admin',
  CONTENT_MANAGER: 'Content Manager',
  VIEWER: 'Viewer',
};

const ROLE_OPTIONS = ['ADMIN', 'CONTENT_MANAGER', 'VIEWER'] as const;
type OrgRole = typeof ROLE_OPTIONS[number];

function RoleBadge({ role }: { role: string }) {
  const colours: Record<string, string> = {
    SUPER_ADMIN: 'bg-amber-900 text-amber-300',
    ADMIN: 'bg-purple-900 text-purple-300',
    CONTENT_MANAGER: 'bg-blue-900 text-blue-300',
    VIEWER: 'bg-gray-800 text-gray-400',
  };
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colours[role] ?? colours.VIEWER}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

export default function MembersPage() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.users.list.useQuery();
  const invite = trpc.users.invite.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      setShowInviteForm(false);
      setInviteToken(null);
    },
  });
  const updateRole = trpc.users.updateRole.useMutation({ onSuccess: () => utils.users.list.invalidate() });
  const remove = trpc.users.remove.useMutation({ onSuccess: () => utils.users.list.invalidate() });
  const revokeInvite = trpc.users.revokeInvite.useMutation({ onSuccess: () => utils.users.list.invalidate() });
  const auditQuery = trpc.audit.list.useQuery({ limit: 30 });

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('VIEWER');
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const inviteLink = inviteToken
    ? `${window.location.origin}/invite/${inviteToken}`
    : null;

  async function handleInvite() {
    const result = await invite.mutateAsync({
      email: inviteEmail,
      name: inviteName || undefined,
      role: inviteRole,
    });
    setInviteToken(result.token);
    setInviteEmail('');
    setInviteName('');
    setInviteRole('VIEWER');
  }

  function copyLink() {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function formatDate(d: Date | string) {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatRelative(d: Date | string) {
    const secs = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (secs < 60) return 'just now';
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Members table */}
      <section className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-400" />
            Members
          </h2>
          {!showInviteForm && (
            <button
              onClick={() => { setShowInviteForm(true); setInviteToken(null); }}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Invite
            </button>
          )}
        </div>

        {/* Invite form */}
        {showInviteForm && (
          <div className="px-6 py-4 border-b border-gray-800 bg-gray-800/50 space-y-3">
            {inviteToken ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">Share this link with the invitee — it expires in 7 days:</p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={inviteLink ?? ''}
                    className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-300 font-mono"
                  />
                  <button
                    onClick={copyLink}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <button
                  onClick={() => { setShowInviteForm(false); setInviteToken(null); }}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 items-end">
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Name (optional)"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                  className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <button
                  onClick={handleInvite}
                  disabled={!inviteEmail || invite.isPending}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                >
                  {invite.isPending ? 'Sending…' : 'Generate link'}
                </button>
                <button
                  onClick={() => setShowInviteForm(false)}
                  className="text-sm text-gray-500 hover:text-gray-300 px-2"
                >
                  Cancel
                </button>
                {invite.error && <p className="w-full text-xs text-red-400">{invite.error.message}</p>}
              </div>
            )}
          </div>
        )}

        {/* Members list */}
        {isLoading ? (
          <div className="px-6 py-8 text-sm text-gray-500">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {data?.users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-800/30">
                  <td className="px-6 py-3">
                    <div className="font-medium text-white">{user.name ?? '—'}</div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-3">
                    {user.role === 'SUPER_ADMIN' ? (
                      <RoleBadge role={user.role} />
                    ) : (
                      <div className="flex flex-col">
                        <select
                          value={user.role}
                          onChange={(e) => updateRole.mutate({ userId: user.id, role: e.target.value as OrgRole })}
                          className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">Role changes take effect on next login</p>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-500">{formatDate(user.createdAt)}</td>
                  <td className="px-6 py-3 text-right">
                    {user.role !== 'SUPER_ADMIN' && (
                      <button
                        onClick={() => { if (confirm(`Remove ${user.email}?`)) remove.mutate({ userId: user.id }); }}
                        className="rounded p-1.5 text-gray-600 hover:text-red-400 hover:bg-gray-800 transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Pending invites */}
      {(data?.invites?.length ?? 0) > 0 && (
        <section className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              Pending Invites
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {data?.invites.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-800/30">
                  <td className="px-6 py-3">
                    <div className="text-white">{inv.email}</div>
                    {inv.name && <div className="text-xs text-gray-500">{inv.name}</div>}
                  </td>
                  <td className="px-6 py-3"><RoleBadge role={inv.role} /></td>
                  <td className="px-6 py-3 text-xs text-gray-500">{formatDate(inv.expiresAt)}</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          const link = `${window.location.origin}/invite/${inv.token}`;
                          navigator.clipboard.writeText(link);
                        }}
                        className="rounded p-1.5 text-gray-600 hover:text-blue-400 hover:bg-gray-800 transition-colors"
                        title="Copy invite link"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { if (confirm(`Revoke invite for ${inv.email}?`)) revokeInvite.mutate({ inviteId: inv.id }); }}
                        className="rounded p-1.5 text-gray-600 hover:text-red-400 hover:bg-gray-800 transition-colors"
                        title="Revoke invite"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Audit log */}
      <section className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Audit Log</h2>
        </div>
        {auditQuery.isLoading ? (
          <div className="px-6 py-8 text-sm text-gray-500">Loading…</div>
        ) : (auditQuery.data?.logs.length ?? 0) === 0 ? (
          <div className="px-6 py-8 text-sm text-gray-500">No activity yet.</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {(auditQuery.data?.logs as AuditLogEntry[] | undefined ?? []).map((log) => (
              <div key={log.id} className="px-6 py-3 flex items-start justify-between gap-4">
                <div>
                  <span className="text-xs font-mono text-gray-500 mr-2">{log.action}</span>
                  <span className="text-sm text-white">
                    <span className="text-gray-400">{log.actorName}</span>
                    {log.targetName && <> → <span className="text-gray-300">{log.targetName}</span></>}
                  </span>
                </div>
                <span className="text-xs text-gray-600 whitespace-nowrap">{formatRelative(log.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
