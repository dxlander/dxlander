/**
 * Integration test setup file
 * Handles module compatibility issues for database drivers
 */

import { vi } from 'vitest';

// Mock the pg module to prevent ESM loading issues in Vitest
// The actual tests use SQLite (better-sqlite3), but drizzle-orm
// tries to load pg at import time for PostgreSQL support
vi.mock('pg', () => {
  class Pool {
    query() {
      throw new Error('PostgreSQL is not configured for tests. Tests use SQLite.');
    }
    end() {
      return Promise.resolve();
    }
  }

  class Client {
    query() {
      throw new Error('PostgreSQL is not configured for tests. Tests use SQLite.');
    }
    connect() {
      return Promise.resolve();
    }
    end() {
      return Promise.resolve();
    }
  }

  return {
    Pool,
    Client,
    default: { Pool, Client },
  };
});

// Mock pg-pool to prevent compatibility issues
vi.mock('pg-pool', () => {
  class Pool {
    query() {
      throw new Error('PostgreSQL is not configured for tests. Tests use SQLite.');
    }
    end() {
      return Promise.resolve();
    }
  }

  return {
    default: Pool,
    Pool,
  };
});
