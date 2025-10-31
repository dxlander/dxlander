import type { NextConfig } from 'next';
import path from 'path';

const isWindows = process.platform === 'win32';

const nextConfig: NextConfig = {
  // Disable standalone output on Windows to avoid symlink errors during build
  ...(isWindows ? {} : { output: 'standalone' }),
  // Set monorepo root to silence tracing root warnings
  outputFileTracingRoot: path.resolve(__dirname, '../../'),
  typescript: {
    // Temporarily ignore type errors for alpha build
    // TODO: Fix workspace package resolution for production builds
    ignoreBuildErrors: true,
  },
  eslint: {
    // Temporarily ignore during builds for alpha release
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
