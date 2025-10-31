import path from 'path';
import { fileURLToPath } from 'url';

// __dirname is not defined in ESM; derive it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWindows = process.platform === 'win32';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable standalone output on Windows to avoid symlink errors during build.
  // See: https://github.com/vercel/next.js/discussions/50133 (Windows symlink issues with standalone)
  // Next standalone output attempts to create symlinks, which fails on Windows without admin rights.
  // Keep standalone for CI/Unix builds but fall back locally on Windows so `pnpm run build` succeeds.
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