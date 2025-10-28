import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,ts,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      'apps/*/dist',
      'packages/*/dist',
      'apps/web/.next',
      'apps/web/**',
      '**/*.d.ts',
    ],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  esbuild: {
    target: 'node18',
  },
});
