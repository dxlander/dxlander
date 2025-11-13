import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup-integration.ts'],
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
      'tests/integration/api/**', // Blocked by pg module ESM issue
      'tests/integration/integrations/**', // Blocked by pg module ESM issue
    ],
    testTimeout: 30000,
    hookTimeout: 30000,
    server: {
      deps: {
        // Inline workspace packages for proper module resolution
        inline: [/@dxlander\/.*/],
        // External dependencies that have issues with Vite transformation
        external: ['pg', 'pg-native'],
      },
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
