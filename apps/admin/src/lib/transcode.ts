import { spawn } from 'child_process';
import { createWriteStream, unlink, mkdirSync } from 'fs';
import { join } from 'path';
import { getMinio } from './minio';
import { randomUUID } from 'crypto';

const TMP = '/tmp/signflow-tc';

/**
 * Fire-and-forget video transcoding.
 * Re-encodes to H.264 Baseline + AAC with faststart so any TV browser can play it.
 * Calls updateUrl when the transcoded file is ready.
 */
export function transcodeVideo(
  key: string,
  bucket: string,
  updateUrl: (url: string) => Promise<void>
): void {
  _run(key, bucket, updateUrl).catch((err) =>
    console.error('[transcode] failed for key', key, err?.message ?? err)
  );
}

async function _run(
  key: string,
  bucket: string,
  updateUrl: (url: string) => Promise<void>
): Promise<void> {
  mkdirSync(TMP, { recursive: true });
  const id = randomUUID();
  const inputPath = join(TMP, `${id}-in`);
  const outputPath = join(TMP, `${id}-out.mp4`);

  try {
    // Download original from MinIO
    const stream = await getMinio().getObject(bucket, key);
    await new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(inputPath);
      stream.pipe(ws);
      ws.on('finish', resolve);
      stream.on('error', reject);
      ws.on('error', reject);
    });

    // Re-encode: H.264 Baseline L3.1 + yuv420p + AAC + moov-atom-at-front (faststart).
    // Baseline L3.1 plays on every Samsung/LG/Tizen/WebOS TV from 2013+.
    // yuv420p is required by older Tizen TVs that reject yuv422/yuv444.
    // faststart moves moov to the front so HTTP streaming starts without full download.
    await new Promise<void>((resolve, reject) => {
      const ff = spawn('ffmpeg', [
        '-i', inputPath,
        '-c:v', 'libx264', '-profile:v', 'baseline', '-level:v', '3.1',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        '-y', outputPath,
      ]);
      // Must consume stderr to prevent the pipe buffer filling and blocking ffmpeg
      ff.stderr.on('data', () => {});
      ff.on('close', (code) =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`))
      );
      ff.on('error', reject);
    });

    // Upload transcoded file under a sibling key
    const tcKey = key.replace(/(\.[^./]+)?$/, '-tc.mp4');
    await getMinio().fPutObject(bucket, tcKey, outputPath, { 'Content-Type': 'video/mp4' });

    // Build public URL (server-generated key — no regex guard needed)
    const segments = tcKey.split('/').map(encodeURIComponent);
    const tcUrl = `${process.env.MINIO_PUBLIC_URL}/${bucket}/${segments.join('/')}`;
    await updateUrl(tcUrl);
  } finally {
    unlink(inputPath, () => {});
    unlink(outputPath, () => {});
  }
}
