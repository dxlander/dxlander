import { defineConfig } from 'vitest/config';
import * as path from 'path';

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
      'tests/e2e/**', // E2E tests run with Playwright, not Vitest
    ],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Inline workspace packages for proper module resolution
    deps: {
      inline: [/@dxlander\/.*/],
    },
  },
  esbuild: {
    target: 'node18',
  },
  resolve: {
    alias: {
      '@dxlander/database': path.resolve(__dirname, './packages/database/src/index.ts'),
      '@dxlander/shared': path.resolve(__dirname, './packages/shared/src/index.ts'),
      '@dxlander/ai-agents': path.resolve(__dirname, './packages/ai-agents/src/index.ts'),
    },
    // Ensure external dependencies like drizzle-orm are properly resolved
    conditions: ['node', 'import', 'module', 'browser', 'default'],
  },
});
