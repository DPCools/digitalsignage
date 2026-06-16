import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@signflow/types'],
  images: { unoptimized: true },
};

export default nextConfig;
