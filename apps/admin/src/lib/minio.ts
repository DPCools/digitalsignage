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

// Extension is derived server-side from validated MIME type — never from user-supplied filename
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'application/pdf': 'pdf',
};

export const ALLOWED_MIMES = Object.keys(MIME_TO_EXT);

export const MIME_TO_CONTENT_TYPE: Record<string, 'IMAGE' | 'VIDEO' | 'PDF'> = {
  'image/jpeg': 'IMAGE',
  'image/png': 'IMAGE',
  'image/webp': 'IMAGE',
  'image/gif': 'IMAGE',
  'video/mp4': 'VIDEO',
  'video/webm': 'VIDEO',
  'application/pdf': 'PDF',
};

const MAX_SIZE: Record<string, number> = {
  image: 50 * 1024 * 1024,
  video: 2 * 1024 * 1024 * 1024,
  application: 100 * 1024 * 1024,
};

export function getMaxSize(mimeType: string): number {
  const [category] = mimeType.split('/');
  return MAX_SIZE[category] ?? 50 * 1024 * 1024;
}

const VALID_KEY_RE = /^uploads\/[a-z0-9][a-z0-9-]*\/\d{13}-[0-9a-f-]{36}\.[a-z0-9]{2,4}$/;

export async function getPresignedUploadUrl(
  orgSlug: string,
  mimeType: string
): Promise<{ url: string; key: string }> {
  const ext = MIME_TO_EXT[mimeType];
  if (!ext) throw new Error('Unsupported MIME type');
  const key = `uploads/${orgSlug}/${Date.now()}-${randomUUID()}.${ext}`;
  const minio = getMinio();

  const url = await minio.presignedPutObject(
    process.env.MINIO_BUCKET!,
    key,
    15 * 60
  );
  return { url, key };
}

export function getPublicUrl(key: string): string {
  if (!VALID_KEY_RE.test(key) || key.includes('..')) {
    throw new Error('Invalid storage key');
  }
  const segments = key.split('/').map(encodeURIComponent);
  return `${process.env.MINIO_PUBLIC_URL}/${process.env.MINIO_BUCKET}/${segments.join('/')}`;
}
