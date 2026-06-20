// Global semaphore for concurrent RTSP→FFmpeg transcodes.
// Uses globalThis so the count survives Next.js hot-reloads within a process.
const g = globalThis as typeof globalThis & { __rtspTranscodeCount: number };
g.__rtspTranscodeCount ??= 0;

export const RTSP_HARD_CAP = 10;

export function tryAcquireTranscode(max: number): boolean {
  if (g.__rtspTranscodeCount >= Math.min(max, RTSP_HARD_CAP)) return false;
  g.__rtspTranscodeCount++;
  return true;
}

export function releaseTranscode(): void {
  g.__rtspTranscodeCount = Math.max(0, g.__rtspTranscodeCount - 1);
}

export function currentTranscodeCount(): number {
  return g.__rtspTranscodeCount;
}
