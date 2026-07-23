'use client';
import { X, Download, MonitorPlay, Image as ImageIcon } from 'lucide-react';
import { trpc } from '@/lib/trpc-client';
import { fmtMs, fmtType, downloadCsv } from '@/lib/format';

export type DrillDownSubject =
  | { type: 'screen'; id: string; name: string }
  | { type: 'content'; id: string; name: string };

type Days = 7 | 30 | 90;

export function DrillDownModal({
  subject,
  days,
  onClose,
  onPivot,
}: {
  subject: DrillDownSubject;
  days: Days;
  onClose: () => void;
  onPivot: (subject: DrillDownSubject) => void;
}) {
  const isScreen = subject.type === 'screen';

  const contentByScreen = trpc.analytics.contentByScreen.useQuery(
    { screenId: subject.id, days },
    { enabled: isScreen }
  );
  const screensByContent = trpc.analytics.screensByContent.useQuery(
    { contentItemId: subject.id, days },
    { enabled: !isScreen }
  );

  const { data, isLoading } = isScreen ? contentByScreen : screensByContent;

  function exportCsv() {
    if (!data) return;
    if (isScreen) {
      const header = ['Content Name', 'Type', 'Plays', 'Total Time'];
      const rows = (data as NonNullable<typeof contentByScreen.data>).map((r) => [
        r.name, fmtType(r.type), String(r.plays), fmtMs(r.totalMs),
      ]);
      downloadCsv(`proof-of-play-${subject.name}-content-${days}d.csv`, [header, ...rows]);
    } else {
      const header = ['Screen', 'Plays', 'Total Time'];
      const rows = (data as NonNullable<typeof screensByContent.data>).map((r) => [
        r.name, String(r.plays), fmtMs(r.totalMs),
      ]);
      downloadCsv(`proof-of-play-${subject.name}-screens-${days}d.csv`, [header, ...rows]);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-gray-700 bg-gray-900 overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2 min-w-0">
            {isScreen ? (
              <MonitorPlay className="w-4 h-4 text-gray-400 shrink-0" />
            ) : (
              <ImageIcon className="w-4 h-4 text-gray-400 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-xs text-gray-500">{isScreen ? 'Content played on' : 'Screens that played'}</p>
              <h2 className="font-semibold text-white truncate" title={subject.name}>{subject.name}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 ml-4 rounded p-1 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="py-12 text-center text-gray-500 text-sm">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider text-left sticky top-0 bg-gray-900">
                  <th className="px-5 py-3 font-medium">{isScreen ? 'Content' : 'Screen'}</th>
                  {isScreen && <th className="px-5 py-3 font-medium hidden sm:table-cell">Type</th>}
                  <th className="px-5 py-3 font-medium text-right">Plays</th>
                  <th className="px-5 py-3 font-medium text-right hidden md:table-cell">Total time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {isScreen && contentByScreen.data?.map((row) => (
                  <tr
                    key={row.contentItemId}
                    onClick={() => onPivot({ type: 'content', id: row.contentItemId, name: row.name })}
                    className="hover:bg-gray-800/20 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3 text-white font-medium max-w-[240px]">
                      <span className="block truncate" title={row.name}>{row.name}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 hidden sm:table-cell">{fmtType(row.type)}</td>
                    <td className="px-5 py-3 text-white tabular-nums text-right">{row.plays.toLocaleString()}</td>
                    <td className="px-5 py-3 text-gray-400 tabular-nums text-right hidden md:table-cell">{fmtMs(row.totalMs)}</td>
                  </tr>
                ))}
                {!isScreen && screensByContent.data?.map((row) => (
                  <tr
                    key={row.screenId}
                    onClick={() => onPivot({ type: 'screen', id: row.screenId, name: row.name })}
                    className="hover:bg-gray-800/20 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3 text-white font-medium">{row.name}</td>
                    <td className="px-5 py-3 text-white tabular-nums text-right">{row.plays.toLocaleString()}</td>
                    <td className="px-5 py-3 text-gray-400 tabular-nums text-right hidden md:table-cell">{fmtMs(row.totalMs)}</td>
                  </tr>
                ))}
                {!data?.length && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-gray-500">
                      No impressions recorded for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-gray-800">
          <button
            onClick={exportCsv}
            disabled={!data?.length}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-40 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
