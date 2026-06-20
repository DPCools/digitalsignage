'use client';
import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc-client';
import { RTSP_HARD_CAP } from '@/lib/rtsp-semaphore';
import { Save, Cpu, Film } from 'lucide-react';

export default function SettingsPage() {
  const { data, isLoading } = trpc.settings.get.useQuery();
  const save = trpc.settings.set.useMutation();

  const [fps, setFps]           = useState(8);
  const [maxTx, setMaxTx]       = useState(4);
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    if (!data) return;
    setFps(parseInt(data.rtsp_fps ?? '8', 10));
    setMaxTx(parseInt(data.rtsp_max_transcodes ?? '4', 10));
  }, [data]);

  async function handleSave() {
    await save.mutateAsync({ rtsp_fps: fps, rtsp_max_transcodes: maxTx });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Organisation-wide configuration</p>
      </div>

      <section className="rounded-xl border border-gray-800 bg-gray-900 divide-y divide-gray-800">
        {/* Section header */}
        <div className="px-6 py-4 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            RTSP Transcoding
          </h2>
        </div>

        {isLoading ? (
          <div className="px-6 py-8 text-sm text-gray-500">Loading…</div>
        ) : (
          <>
            {/* FPS */}
            <div className="px-6 py-5 flex items-start justify-between gap-8">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Film className="w-4 h-4 text-gray-400" />
                  <label className="text-sm font-medium text-white">Transcode frame rate</label>
                </div>
                <p className="text-xs text-gray-500">
                  Frames per second FFmpeg outputs for RTSP cameras. Lower = less CPU.
                  8 fps is smooth for CCTV; 15 fps is good for high-motion video.
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={fps}
                  onChange={(e) => setFps(Math.min(30, Math.max(1, Number(e.target.value))))}
                  className="w-20 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white text-right tabular-nums focus:border-blue-500 focus:outline-none"
                />
                <span className="text-sm text-gray-500 w-6">fps</span>
              </div>
            </div>

            {/* Max concurrent transcodes */}
            <div className="px-6 py-5 flex items-start justify-between gap-8">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Cpu className="w-4 h-4 text-gray-400" />
                  <label className="text-sm font-medium text-white">Max concurrent transcodes</label>
                </div>
                <p className="text-xs text-gray-500">
                  How many RTSP→MJPEG FFmpeg processes can run simultaneously.
                  Each active CCTV view on a screen counts as one transcode per camera stream.
                  Hard cap is {RTSP_HARD_CAP} — requests beyond the limit receive a 503.
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={RTSP_HARD_CAP}
                  value={maxTx}
                  onChange={(e) =>
                    setMaxTx(Math.min(RTSP_HARD_CAP, Math.max(1, Number(e.target.value))))
                  }
                  className="w-20 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white text-right tabular-nums focus:border-blue-500 focus:outline-none"
                />
                <span className="text-sm text-gray-500 w-6">/ {RTSP_HARD_CAP}</span>
              </div>
            </div>

            {/* Save */}
            <div className="px-6 py-4 flex items-center justify-between">
              {save.error && (
                <p className="text-xs text-red-400">{save.error.message}</p>
              )}
              {!save.error && saved && (
                <p className="text-xs text-green-400">Settings saved.</p>
              )}
              {!save.error && !saved && <span />}
              <button
                onClick={handleSave}
                disabled={save.isPending}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                {save.isPending ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
