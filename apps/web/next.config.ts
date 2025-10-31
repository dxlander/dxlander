import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname is not defined in ESM; derive it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWindows = process.platform === 'win32';

const nextConfig: NextConfig = {
  // Disable standalone output on Windows to avoid symlink errors during build.
  // See: https://github.com/vercel/next.js/discussions/50133 (Windows symlink issues with standalone)
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
