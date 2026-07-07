// Global semaphore for concurrent audio-bridge FFmpeg pushes.
// Separate pool from rtsp-semaphore.ts — audio pushes must not compete with
// RTSP camera transcodes for their concurrency budget.
// Uses globalThis so the count survives Next.js hot-reloads within a process.
const g = globalThis as typeof globalThis & { __audioBridgePushCount: number };
g.__audioBridgePushCount ??= 0;

export const AUDIO_BRIDGE_HARD_CAP = 20;

export function tryAcquireAudioPush(max: number = AUDIO_BRIDGE_HARD_CAP): boolean {
  if (g.__audioBridgePushCount >= Math.min(max, AUDIO_BRIDGE_HARD_CAP)) return false;
  g.__audioBridgePushCount++;
  return true;
}

export function releaseAudioPush(): void {
  g.__audioBridgePushCount = Math.max(0, g.__audioBridgePushCount - 1);
}

export function currentAudioPushCount(): number {
  return g.__audioBridgePushCount;
}
