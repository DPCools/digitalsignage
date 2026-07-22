// Cache Storage bucket names shared between next.config.ts (Workbox runtimeCaching
// build config) and client-side asset warm/prune logic — keeping them in one place
// means the two can never drift apart.
export const CACHE_NAMES = {
  video: 'media-video',
  images: 'media-images',
  pdf: 'media-pdf',
  html: 'media-html',
} as const;

export const CACHEABLE_CACHE_NAMES: string[] = Object.values(CACHE_NAMES);
