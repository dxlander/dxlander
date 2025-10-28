import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { PostgresConfig } from './types';
import * as schema from './schema';

export function createPostgresConnection(config: PostgresConfig) {
  // Validate required parameters
  if (!config.host?.trim() || !config.database?.trim() || !config.user?.trim()) {
    throw new Error(
      'Missing or invalid required PostgreSQL configuration parameters (host, database, user)'
    );
  }

  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl, // <-- Key change for flexible SSL config!
    max: 20, // Maximum pool size
    idleTimeoutMillis: 30000, // 30 seconds
    connectionTimeoutMillis: 5000, // 5 seconds
  });

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
  });

  const db = drizzle(pool, { schema });

  return {
    db,
    pool,
    async close() {
      try {
        await pool.end();
      } catch (error) {
        console.error('Error closing PostgreSQL pool:', error);
        throw error;
      }
    },
  };
}
