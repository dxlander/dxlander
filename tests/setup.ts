import { afterEach, beforeEach, vi } from 'vitest';

import { join } from 'path';
import { tmpdir } from 'os';

// Global test setup
beforeEach(async () => {
  // Clear all mocks before each test
  vi.clearAllMocks();

  // Mock console methods to reduce noise in tests
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  // Restore console methods
  vi.restoreAllMocks();
});

// Global test utilities
(globalThis as any).testUtils = {
  createTestId: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  createTestPath: (suffix: string) => join(tmpdir(), `dxlander-test-${suffix}`),
};
