import * as Minio from 'minio';
import { randomUUID } from 'crypto';

let client: Minio.Client | null = null;

export function getMinio(): Minio.Client {
  if (!client) {
    client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT!,
      port: parseInt(process.env.MINIO_PORT ?? '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY!,
      secretKey: process.env.MINIO_SECRET_KEY!,
    });
  }
  return client;
}

let policyApplied = false;

// Ensures only uploads/* is publicly readable.
// snapshots/* must NOT be public — they may contain CCTV frames or sensitive
// screen content. Serve them via /api/admin/snapshot which enforces session auth.
export async function ensureBucketPolicy(): Promise<void> {
  if (policyApplied) return;
  policyApplied = true;
  try {
    const bucket = process.env.MINIO_BUCKET!;
    const policy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucket}/uploads/*`],
        },
      ],
    });
    await getMinio().setBucketPolicy(bucket, policy);
  } catch (err) {
    console.error('[minio] failed to set bucket policy:', err);
  }
}

export function snapshotUrlToKey(url: string): string | null {
  const base = `${process.env.MINIO_PUBLIC_URL}/${process.env.MINIO_BUCKET}/`;
  if (!url.startsWith(base)) return null;
  return decodeURIComponent(url.slice(base.length).split('?')[0]);
}

// Extension is derived server-side from validated MIME type — never from user-supplied filename.
// All video formats are accepted because the upload pipeline transcodes to H.264 regardless.
const MIME_TO_EXT: Record<string, string> = {
  // Images
  'image/jpeg':      'jpg',
  'image/png':       'png',
  'image/webp':      'webp',
  'image/gif':       'gif',
  'image/avif':      'avif',
  // Videos — broad list; ffmpeg transcodes all of these to H.264/AAC on ingest
  'video/mp4':               'mp4',
  'video/webm':              'webm',
  'video/quicktime':         'mov',   // iPhone/Mac recordings
  'video/x-msvideo':         'avi',
  'video/x-matroska':        'mkv',
  'video/x-ms-wmv':          'wmv',
  'video/mpeg':              'mpeg',
  'video/3gpp':              '3gp',
  'video/x-flv':             'flv',
  // Documents
  'application/pdf': 'pdf',
};

export const ALLOWED_MIMES = Object.keys(MIME_TO_EXT);

export const MIME_TO_CONTENT_TYPE: Record<string, 'IMAGE' | 'VIDEO' | 'PDF'> = {
  'image/jpeg':      'IMAGE',
  'image/png':       'IMAGE',
  'image/webp':      'IMAGE',
  'image/gif':       'IMAGE',
  'image/avif':      'IMAGE',
  'video/mp4':               'VIDEO',
  'video/webm':              'VIDEO',
  'video/quicktime':         'VIDEO',
  'video/x-msvideo':         'VIDEO',
  'video/x-matroska':        'VIDEO',
  'video/x-ms-wmv':          'VIDEO',
  'video/mpeg':              'VIDEO',
  'video/3gpp':              'VIDEO',
  'video/x-flv':             'VIDEO',
  'application/pdf': 'PDF',
};

const MAX_SIZE: Record<string, number> = {
  image:       50  * 1024 * 1024,
  video:       4   * 1024 * 1024 * 1024,  // 4 GB
  application: 100 * 1024 * 1024,
};

export function getMaxSize(mimeType: string): number {
  const [category] = mimeType.split('/');
  return MAX_SIZE[category] ?? 50 * 1024 * 1024;
}

const VALID_KEY_RE = /^uploads\/[a-z0-9][a-z0-9-]*\/\d{13}-[0-9a-f-]{36}\.[a-z0-9]{2,5}$/;

export async function getPresignedUploadUrl(
  orgSlug: string,
  mimeType: string
): Promise<{ url: string; key: string }> {
  const ext = MIME_TO_EXT[mimeType];
  if (!ext) throw new Error('Unsupported MIME type');
  const key = `uploads/${orgSlug}/${Date.now()}-${randomUUID()}.${ext}`;
  const minio = getMinio();

  const rawUrl = await minio.presignedPutObject(
    process.env.MINIO_BUCKET!,
    key,
    15 * 60
  );
  // Replace internal endpoint with public URL so the browser can reach it
  const internalBase = `http${process.env.MINIO_USE_SSL === 'true' ? 's' : ''}://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT ?? '9000'}`;
  const url = rawUrl.replace(internalBase, process.env.MINIO_PUBLIC_URL!);
  return { url, key };
}

export function getPublicUrl(key: string): string {
  if (!VALID_KEY_RE.test(key) || key.includes('..')) {
    throw new Error('Invalid storage key');
  }
  const segments = key.split('/').map(encodeURIComponent);
  return `${process.env.MINIO_PUBLIC_URL}/${process.env.MINIO_BUCKET}/${segments.join('/')}`;
}
