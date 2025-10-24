import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
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
