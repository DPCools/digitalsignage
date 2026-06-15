import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@signflow/ui', '@signflow/db', '@signflow/types'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
