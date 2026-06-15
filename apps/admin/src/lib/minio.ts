import * as Minio from 'minio';

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

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'application/pdf': ['.pdf'],
};

export const ALLOWED_MIMES = Object.keys(ALLOWED_MIME_TYPES);

const MAX_SIZE: Record<string, number> = {
  image: 50 * 1024 * 1024,
  video: 2 * 1024 * 1024 * 1024,
  application: 100 * 1024 * 1024,
};

export function getMaxSize(mimeType: string): number {
  const [category] = mimeType.split('/');
  return MAX_SIZE[category] ?? 50 * 1024 * 1024;
}

export async function getPresignedUploadUrl(
  orgSlug: string,
  filename: string,
  mimeType: string
): Promise<{ url: string; key: string }> {
  const ext = filename.split('.').pop() ?? '';
  const key = `uploads/${orgSlug}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const minio = getMinio();

  const url = await minio.presignedPutObject(
    process.env.MINIO_BUCKET!,
    key,
    15 * 60
  );
  return { url, key };
}

export function getPublicUrl(key: string): string {
  return `${process.env.MINIO_PUBLIC_URL}/${process.env.MINIO_BUCKET}/${key}`;
}
