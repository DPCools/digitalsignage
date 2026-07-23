'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { RTSP_HARD_CAP } from '@/lib/rtsp-semaphore';
import { Save, Cpu, Film, Volume2, Upload, Trash2, Play, Pause, Loader2, AlertTriangle } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RecipientListsSection } from '@/components/settings/RecipientListsSection';
import { EmailTemplatesSection } from '@/components/settings/EmailTemplatesSection';

function AlertSoundsSection() {
  const { data: sounds, refetch } = trpc.alertSounds.list.useQuery();
  const presign   = trpc.alertSounds.presignUpload.useMutation();
  const confirm   = trpc.alertSounds.confirmUpload.useMutation({ onSuccess: () => refetch() });
  const del       = trpc.alertSounds.delete.useMutation({ onSuccess: () => { setConfirmDeleteId(null); refetch(); } });

  const fileRef   = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const audioRef  = useRef<HTMLAudioElement | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadErr('');
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const mime = file.type || 'audio/mpeg';
        const { uploadUrl, key, publicUrl } = await presign.mutateAsync({ mimeType: mime });
        const res = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': mime } });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const name = file.name.replace(/\.[^.]+$/, '');
        await confirm.mutateAsync({ key, name, url: publicUrl });
      }
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function togglePlay(sound: { id: string; url: string }) {
    if (playingId === sound.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      audioRef.current?.pause();
      const audio = new Audio(sound.url);
      audio.onended = () => setPlayingId(null);
      audio.play();
      audioRef.current = audio;
      setPlayingId(sound.id);
    }
  }

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900 divide-y divide-gray-800">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Alert Sounds</h2>
        </div>
        <label className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
          uploading ? 'bg-gray-700 text-gray-400' : 'bg-blue-600 hover:bg-blue-500 text-white'
        }`}>
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? 'Uploading…' : 'Upload sounds'}
          <input
            ref={fileRef}
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/aac,audio/mp4"
            multiple
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={uploading}
          />
        </label>
      </div>

      {uploadErr && (
        <div className="px-6 py-3 text-sm text-red-400">{uploadErr}</div>
      )}

      {!sounds || sounds.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-gray-500">
          No alert sounds uploaded yet. Upload MP3, WAV, OGG, or AAC files.
        </div>
      ) : (
        <ul className="divide-y divide-gray-800">
          {sounds.map((s) => (
            <li key={s.id} className="px-6 py-3 flex items-center gap-3">
              <button
                onClick={() => togglePlay(s)}
                className="shrink-0 w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
              >
                {playingId === s.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <span className="flex-1 text-sm text-white truncate">{s.name}</span>
              <span className="text-xs text-gray-500 shrink-0">
                {new Date(s.createdAt).toLocaleDateString()}
              </span>
              {confirmDeleteId === s.id ? (
                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-xs text-amber-400">Delete this sound?</span>
                  <button
                    onClick={() => del.mutate({ id: s.id })}
                    disabled={del.isPending}
                    className="rounded px-2 py-1 text-xs font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-40 transition-colors"
                  >
                    {del.isPending ? 'Deleting…' : 'Delete'}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="rounded px-2 py-1 text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(s.id)}
                  className="shrink-0 p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Hidden "danger zone" for wiping alert history. Stays out of the way until you
// hold Ctrl+Shift+Alt together — then it reveals for the rest of the session so
// you can comfortably click through the confirmation. Easter egg by request.
function AlertHistoryResetSection() {
  const [revealed, setRevealed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removed, setRemoved] = useState<number | null>(null);

  const reset = trpc.alerts.resetHistory.useMutation({
    onSuccess: (r) => {
      setConfirming(false);
      setRemoved(r.count);
    },
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.altKey) setRevealed(true);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!revealed) return null;

  return (
    <section className="rounded-xl border border-red-900/50 bg-red-950/20 divide-y divide-red-900/30">
      <div className="px-6 py-4 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-red-400" />
        <h2 className="text-sm font-semibold text-red-300 uppercase tracking-wider">Danger Zone</h2>
      </div>
      <div className="px-6 py-5 flex items-start justify-between gap-8">
        <div className="flex-1">
          <p className="text-sm font-medium text-white">Reset alert history</p>
          <p className="text-xs text-gray-400 mt-1">
            Permanently deletes all past (inactive) emergency alerts. Any currently active alert is kept.
            {removed !== null && (
              <span className="text-green-400"> Removed {removed} alert{removed !== 1 ? 's' : ''}.</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setConfirming(true)}
          className="shrink-0 flex items-center gap-1.5 rounded-lg border border-red-800/50 bg-red-950/40 px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-900/50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Reset history
        </button>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Reset alert history?"
        message="This permanently deletes all past emergency alerts. Any currently active alert is kept. This can’t be undone."
        confirmLabel="Reset history"
        pending={reset.isPending}
        error={reset.error?.message}
        onConfirm={() => reset.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}

// Hidden "danger zone" for wiping the audit log. Same reveal gesture as
// AlertHistoryResetSection — hold Ctrl+Shift+Alt together.
function AuditLogResetSection() {
  const [revealed, setRevealed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removed, setRemoved] = useState<number | null>(null);

  const reset = trpc.audit.resetHistory.useMutation({
    onSuccess: (r) => {
      setConfirming(false);
      setRemoved(r.count);
    },
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.altKey) setRevealed(true);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!revealed) return null;

  return (
    <section className="rounded-xl border border-red-900/50 bg-red-950/20 divide-y divide-red-900/30">
      <div className="px-6 py-4 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-red-400" />
        <h2 className="text-sm font-semibold text-red-300 uppercase tracking-wider">Danger Zone</h2>
      </div>
      <div className="px-6 py-5 flex items-start justify-between gap-8">
        <div className="flex-1">
          <p className="text-sm font-medium text-white">Clear audit log</p>
          <p className="text-xs text-gray-400 mt-1">
            Permanently deletes every audit log entry.
            {removed !== null && (
              <span className="text-green-400"> Removed {removed} entr{removed === 1 ? 'y' : 'ies'}.</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setConfirming(true)}
          className="shrink-0 flex items-center gap-1.5 rounded-lg border border-red-800/50 bg-red-950/40 px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-900/50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear audit log
        </button>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Clear audit log?"
        message="This permanently deletes every audit log entry. This can’t be undone."
        confirmLabel="Clear log"
        pending={reset.isPending}
        error={reset.error?.message}
        onConfirm={() => reset.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl h-40" />}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab'); // null (General) | 'smtp' | 'transcoding'

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
    <div className="max-w-2xl space-y-4">
      {!tab && (
        <div className="space-y-4">
          <AlertSoundsSection />
          <AlertHistoryResetSection />
          <AuditLogResetSection />
        </div>
      )}

      {tab === 'smtp' && (
        <div className="space-y-4">
          <RecipientListsSection />
          <EmailTemplatesSection />
        </div>
      )}

      {tab === 'transcoding' && (
        <div className="space-y-4">
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
      )}
    </div>
  );
}
