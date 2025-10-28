import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['../../tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{js,ts,tsx}'],
    exclude: ['node_modules', 'dist', '.next', '**/*.d.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  esbuild: {
    target: 'node18',
  },
});
