import { spawn, type ChildProcess } from 'child_process';
import type { TenantPrismaClient } from '@signflow/db';
import { tryAcquireAudioPush, releaseAudioPush } from './audio-bridge-semaphore';

// Tracks ffmpeg processes spawned per alert so stopAlertAudio() can kill them
// on deactivation/expiry. globalThis-backed so it survives Next.js hot-reloads.
const g = globalThis as typeof globalThis & { __audioBridgeProcs?: Map<string, ChildProcess[]> };
g.__audioBridgeProcs ??= new Map();

function buildDestUrl(host: string, port: number, username: string, password: string): string {
  return `http://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/axis-cgi/audio/transmit.cgi`;
}

// Spawns one ffmpeg process that streams `soundUrl` to a single Axis Audio
// Bridge, matching the known-working manual invocation:
//   ffmpeg -re -stream_loop N -i <url> -acodec pcm_mulaw -ar 8000 -ac 1 -f mulaw
//     -headers "Content-Type: audio/basic" http://user:pass@host/axis-cgi/audio/transmit.cgi
//
// Credentials are passed via env vars rather than embedded in the shell command
// string (mirrors streamRtsp() in api/stream/[streamId]/route.ts) — this keeps
// secrets out of the command string itself, though ffmpeg's own argv will still
// contain the destination URL after exec since Axis only supports URL-embedded
// auth. That tradeoff is already accepted elsewhere in this codebase for RTSP.
function spawnFfmpegPush(
  soundUrl: string,
  destUrl: string,
  loops: number,
  captureStderr: boolean
): ChildProcess {
  return spawn('/bin/sh', [
    '-c',
    `exec /usr/bin/ffmpeg -re -stream_loop ${loops} -i "$SF_SOUND_URL" -acodec pcm_mulaw -ar 8000 -ac 1 -f mulaw -headers "Content-Type: audio/basic" "$SF_DEST_URL"`,
  ], {
    stdio: ['ignore', 'ignore', captureStderr ? 'pipe' : 'ignore'],
    env: {
      ...process.env,
      SF_SOUND_URL: soundUrl,
      SF_DEST_URL: destUrl,
    },
  }) as unknown as ChildProcess;
}

// Streams an alert's sound to every Audio Bridge belonging to the site(s) the
// alert targets. Fire-and-forget from the caller's perspective — never throws,
// a single unreachable bridge must not affect any other bridge or the alert
// creation response.
export async function pushAlertAudio(
  db: TenantPrismaClient,
  alertId: string,
  screenIds: string[],
  soundUrl: string | null | undefined,
  soundRepeat: number
): Promise<void> {
  if (!soundUrl) return;

  try {
    // Resolve target ScreenGroup ids: empty screenIds = org-wide alert = every
    // group's bridges; otherwise resolve each screen's groupId and dedupe.
    let groupIds: string[];
    if (screenIds.length === 0) {
      groupIds = (await db.screenGroup.findMany({ select: { id: true } })).map((g) => g.id);
    } else {
      const screens = await db.screen.findMany({
        where: { id: { in: screenIds }, groupId: { not: null } },
        select: { groupId: true },
      });
      groupIds = [...new Set(screens.map((s) => s.groupId as string))];
    }
    if (groupIds.length === 0) return;

    const bridges = await db.audioBridge.findMany({ where: { groupId: { in: groupIds } } });
    if (bridges.length === 0) return;

    const loops = Math.max(0, soundRepeat - 1);
    const procs: ChildProcess[] = [];

    for (const bridge of bridges) {
      if (!tryAcquireAudioPush()) {
        console.warn(`[audio-bridge] concurrency cap reached, skipping bridge ${bridge.id} (${bridge.name})`);
        continue;
      }
      let released = false;
      const release = () => {
        if (!released) {
          released = true;
          releaseAudioPush();
        }
      };

      try {
        const destUrl = buildDestUrl(bridge.host, bridge.port, bridge.username, bridge.password);
        const proc = spawnFfmpegPush(soundUrl, destUrl, loops, false);
        proc.on('exit', release);
        proc.on('error', (err) => {
          console.error(`[audio-bridge] ffmpeg error for bridge ${bridge.id} (${bridge.name}):`, err);
          release();
        });
        procs.push(proc);
      } catch (err) {
        console.error(`[audio-bridge] failed to spawn ffmpeg for bridge ${bridge.id} (${bridge.name}):`, err);
        release();
      }
    }

    if (procs.length > 0) g.__audioBridgeProcs!.set(alertId, procs);
  } catch (err) {
    console.error('[audio-bridge] pushAlertAudio failed:', err);
  }
}

// Kills every ffmpeg process tracked for this alert. Called on deactivation
// and auto-expiry so a bridge doesn't keep playing after the alert clears.
export function stopAlertAudio(alertId: string): void {
  const procs = g.__audioBridgeProcs?.get(alertId);
  if (!procs) return;
  for (const p of procs) {
    try {
      p.kill('SIGKILL');
    } catch {
      // already dead
    }
  }
  g.__audioBridgeProcs!.delete(alertId);
}

// Ad-hoc single-bridge test push, used by audioBridges.test — captures stderr
// so a real error (auth failure, unreachable host) can be surfaced to the admin,
// and is not tracked in the alert registry since it isn't tied to an alert.
export function testAudioBridge(
  soundUrl: string,
  host: string,
  port: number,
  username: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    if (!tryAcquireAudioPush()) {
      resolve({ ok: false, error: 'Too many concurrent audio pushes in progress — try again shortly.' });
      return;
    }
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        releaseAudioPush();
      }
    };

    const destUrl = buildDestUrl(host, port, username, password);
    const proc = spawnFfmpegPush(soundUrl, destUrl, 0, true);

    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    let settled = false;
    const settle = (result: { ok: true } | { ok: false; error: string }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    proc.on('error', (err) => {
      release();
      settle({ ok: false, error: err.message });
    });
    proc.on('exit', (code) => {
      release();
      if (code === 0 || settled) return;
      settle({ ok: false, error: stderr.trim().slice(-500) || `ffmpeg exited with code ${code}` });
    });

    // If it's still running after 3s without erroring, treat it as reachable
    // and let it finish in the background — a single test play is short-lived.
    setTimeout(() => settle({ ok: true }), 3000);
  });
}
