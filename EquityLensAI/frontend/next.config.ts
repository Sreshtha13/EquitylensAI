import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@equitylensai/shared'],
  poweredByHeader: false,
};

export default nextConfig;
