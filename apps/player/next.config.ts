import type { NextConfig } from 'next';
import withPWA from '@ducanh2912/next-pwa';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@signflow/types'],
  // No Next.js image optimisation — player uses raw <img> tags for performance
  images: { unoptimized: true },
  // Allow LAN devices (TV screens) to load _next/* assets in dev mode.
  // Next.js expects literal hostnames here, NOT CIDR ranges — '192.168.0.0/16'
  // etc. silently never matched anything, which is why HMR/font requests kept
  // getting blocked. In production this is irrelevant — the standalone server
  // serves the same origin.
  allowedDevOrigins: ['192.168.0.213'],
};

export default withPWA({
  dest: 'public',
  // Disable in dev to avoid confusing HMR/cache interactions
  disable: process.env.NODE_ENV === 'development',
  // Cache the app shell (JS/CSS bundles) via Workbox precache
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: false, // player handles reconnect itself
  workboxOptions: {
    // Keep service worker in control immediately — critical for kiosk
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
      // NetworkFirst for config API: always try network, fall back to cache
      {
        urlPattern: /\/api\/player\/config/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'player-config',
          networkTimeoutSeconds: 5,
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 24 * 60 * 60, // 1 day
          },
        },
      },
      // CacheFirst for all media assets — immutable once stored
      {
        urlPattern: /\.(mp4|webm|mov|avi)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'media-video',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          },
        },
      },
      {
        urlPattern: /\.(jpg|jpeg|png|webp|gif|svg|avif)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'media-images',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          },
        },
      },
      {
        urlPattern: /\.pdf$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'media-pdf',
          expiration: {
            maxEntries: 30,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          },
        },
      },
      // CacheFirst for HTML templates served from MinIO
      {
        urlPattern: /\/uploads\/.+\.html$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'media-html',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          },
        },
      },
    ],
  },
})(nextConfig);
