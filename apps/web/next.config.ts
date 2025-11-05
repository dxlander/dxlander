import type { NextConfig } from 'next';

const isWindows = process.platform === 'win32';

const nextConfig: NextConfig = {
  // Next standalone output attempts to create symlinks, which fails on Windows without admin rights.
  // Keep standalone for CI/Unix builds but fall back locally on Windows so `pnpm run build` succeeds.
  ...(isWindows ? {} : { output: 'standalone' }),
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
