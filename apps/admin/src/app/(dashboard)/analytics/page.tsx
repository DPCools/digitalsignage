'use client';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { trpc } from '@/lib/trpc-client';
import { fmtMs, fmtType, downloadCsv } from '@/lib/format';
import { DrillDownModal, type DrillDownSubject } from '@/components/analytics/DrillDownModal';

// ─── period selector ─────────────────────────────────────────────────────────

const PERIODS = [
  { label: '7 days',  value: 7  },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
] as const;

type Days = (typeof PERIODS)[number]['value'];

// ─── stat card ───────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

// ─── by-content table ────────────────────────────────────────────────────────

function ByContentTable({ days, onSelect }: { days: Days; onSelect: (subject: DrillDownSubject) => void }) {
  const { data, isLoading } = trpc.analytics.byContent.useQuery({ days });

  function exportCsv() {
    if (!data) return;
    const header = ['Content Name', 'Type', 'Plays', 'Total Time'];
    const rows   = data.map((r) => [r.name, fmtType(r.type), String(r.plays), fmtMs(r.totalMs)]);
    downloadCsv(`proof-of-play-by-content-${days}d.csv`, [header, ...rows]);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          By Content
        </h2>
        <button
          onClick={exportCsv}
          disabled={!data?.length}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-40 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-gray-500 text-sm">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider text-left">
                <th className="px-5 py-3 font-medium">Content</th>
                <th className="px-5 py-3 font-medium hidden sm:table-cell">Type</th>
                <th className="px-5 py-3 font-medium text-right">Plays</th>
                <th className="px-5 py-3 font-medium text-right hidden md:table-cell">Total time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {data?.map((row) => (
                <tr
                  key={row.contentItemId}
                  onClick={() => onSelect({ type: 'content', id: row.contentItemId, name: row.name })}
                  className="hover:bg-gray-800/20 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3 text-white font-medium max-w-[240px]">
                    <span className="block truncate" title={row.name}>{row.name}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-400 hidden sm:table-cell">
                    {fmtType(row.type)}
                  </td>
                  <td className="px-5 py-3 text-white tabular-nums text-right">{row.plays.toLocaleString()}</td>
                  <td className="px-5 py-3 text-gray-400 tabular-nums text-right hidden md:table-cell">{fmtMs(row.totalMs)}</td>
                </tr>
              ))}
              {!data?.length && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-500">No impressions recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── by-screen table ─────────────────────────────────────────────────────────

function ByScreenTable({ days, onSelect }: { days: Days; onSelect: (subject: DrillDownSubject) => void }) {
  const { data, isLoading } = trpc.analytics.byScreen.useQuery({ days });

  function exportCsv() {
    if (!data) return;
    const header = ['Screen', 'Plays', 'Unique Content Items', 'Total Time'];
    const rows   = data.map((r) => [r.name, String(r.plays), String(r.uniqueContent), fmtMs(r.totalMs)]);
    downloadCsv(`proof-of-play-by-screen-${days}d.csv`, [header, ...rows]);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          By Screen
        </h2>
        <button
          onClick={exportCsv}
          disabled={!data?.length}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-40 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-gray-500 text-sm">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider text-left">
                <th className="px-5 py-3 font-medium">Screen</th>
                <th className="px-5 py-3 font-medium text-right">Plays</th>
                <th className="px-5 py-3 font-medium text-right hidden sm:table-cell">Unique items</th>
                <th className="px-5 py-3 font-medium text-right hidden md:table-cell">Total time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {data?.map((row) => (
                <tr
                  key={row.screenId}
                  onClick={() => onSelect({ type: 'screen', id: row.screenId, name: row.name })}
                  className="hover:bg-gray-800/20 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3 text-white font-medium">{row.name}</td>
                  <td className="px-5 py-3 text-white tabular-nums text-right">{row.plays.toLocaleString()}</td>
                  <td className="px-5 py-3 text-gray-400 tabular-nums text-right hidden sm:table-cell">{row.uniqueContent}</td>
                  <td className="px-5 py-3 text-gray-400 tabular-nums text-right hidden md:table-cell">{fmtMs(row.totalMs)}</td>
                </tr>
              ))}
              {!data?.length && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-500">No impressions recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [days, setDays] = useState<Days>(30);
  const [drillDown, setDrillDown] = useState<DrillDownSubject | null>(null);

  const { data: byContent } = trpc.analytics.byContent.useQuery({ days });
  const { data: byScreen  } = trpc.analytics.byScreen.useQuery({ days });

  const totalPlays   = byContent?.reduce((s, r) => s + r.plays, 0) ?? 0;
  const totalMs      = byContent?.reduce((s, r) => s + r.totalMs, 0) ?? 0;
  const activeScreens = byScreen?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-white">Proof of Play</h1>

        {/* Period selector */}
        <div className="flex rounded-lg border border-gray-700 overflow-hidden text-sm">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setDays(p.value)}
              className={`px-3 py-1.5 transition-colors ${
                days === p.value
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total plays" value={totalPlays.toLocaleString()} />
        <StatCard label="Active screens" value={String(activeScreens)} />
        <StatCard label="Total play time" value={fmtMs(totalMs)} />
      </div>

      {/* Per-content breakdown */}
      <ByContentTable days={days} onSelect={setDrillDown} />

      {/* Per-screen breakdown */}
      <ByScreenTable days={days} onSelect={setDrillDown} />

      {drillDown && (
        <DrillDownModal
          subject={drillDown}
          days={days}
          onClose={() => setDrillDown(null)}
          onPivot={setDrillDown}
        />
      )}
    </div>
  );
}
