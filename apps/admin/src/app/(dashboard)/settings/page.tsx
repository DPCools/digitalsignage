'use client';
import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc-client';
import { RTSP_HARD_CAP } from '@/lib/rtsp-semaphore';
import { Save, Cpu, Film, Music, Upload, Play, Square, Trash2, Loader2, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Alert Sounds Section
// ---------------------------------------------------------------------------
function AlertSoundsSection() {
  const utils = trpc.useUtils();
  const { data: sounds, isLoading } = trpc.settings.listSounds.useQuery();
  const getUploadUrl = trpc.settings.getSoundUploadUrl.useMutation();
  const confirmSound = trpc.settings.confirmSound.useMutation({
    onSuccess: () => utils.settings.listSounds.invalidate(),
  });
  const deleteSound = trpc.settings.deleteSound.useMutation({
    onSuccess: () => utils.settings.listSounds.invalidate(),
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadModal, setUploadModal] = useState<{ file: File; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setPlayingId(null);
  }

  function togglePlay(id: string, url: string) {
    if (playingId === id) {
      stopAudio();
      return;
    }
    stopAudio();
    const audio = new Audio(url);
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    setPlayingId(id);
    audio.play().catch(() => setPlayingId(null));
  }

  // Stop audio on unmount
  useEffect(() => () => stopAudio(), []);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.replace(/\.[^.]+$/, '');
    setUploadModal({ file, name });
    setUploadError('');
    e.target.value = '';
  }

  async function handleUpload() {
    if (!uploadModal) return;
    setUploading(true);
    setUploadError('');
    try {
      const { url, key } = await getUploadUrl.mutateAsync({ mimeType: uploadModal.file.type });
      const res = await fetch(url, {
        method: 'PUT',
        body: uploadModal.file,
        headers: { 'Content-Type': uploadModal.file.type },
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      await confirmSound.mutateAsync({ key, name: uploadModal.name.trim() || uploadModal.file.name });
      setUploadModal(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900 divide-y divide-gray-800">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Alert Sounds</h2>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" /> Add Sound
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {isLoading ? (
        <div className="px-6 py-8 text-sm text-gray-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : sounds && sounds.length > 0 ? (
        <div className="divide-y divide-gray-800">
          {sounds.map((s) => (
            <div key={s.id} className="px-6 py-3 flex items-center gap-3">
              <button
                onClick={() => togglePlay(s.id, s.url)}
                className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                title={playingId === s.id ? 'Stop' : 'Preview'}
              >
                {playingId === s.id
                  ? <Square className="w-4 h-4 fill-current" />
                  : <Play className="w-4 h-4 fill-current" />}
              </button>
              <span className="flex-1 text-sm text-white truncate">{s.name}</span>
              <button
                onClick={() => { stopAudio(); deleteSound.mutate({ id: s.id }); }}
                disabled={deleteSound.isPending}
                className="shrink-0 rounded-lg p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-6 py-8 text-sm text-gray-500 text-center">
          No alert sounds yet. Click <strong className="text-gray-400">Add Sound</strong> to upload MP3, WAV, or OGG files.
        </div>
      )}

      {/* Upload modal */}
      {uploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white">Add Alert Sound</h2>
              <button onClick={() => setUploadModal(null)} disabled={uploading}>
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>
            <div className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-xs text-gray-400 truncate">
              {uploadModal.file.name}
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Sound name</label>
              <input
                value={uploadModal.name}
                onChange={(e) => setUploadModal((m) => m ? { ...m, name: e.target.value } : m)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm"
                placeholder="e.g. Alarm Siren"
                disabled={uploading}
              />
            </div>
            {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setUploadModal(null)} disabled={uploading}
                className="flex-1 rounded-lg border border-gray-700 py-2 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadModal.name.trim()}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main settings page
// ---------------------------------------------------------------------------
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
    <div className="max-w-2xl space-y-4">
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

      <AlertSoundsSection />
    </div>
  );
}
