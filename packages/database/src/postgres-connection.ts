import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { PostgresConfig } from './types';
import * as schema from './schema';

export function createPostgresConnection(config: PostgresConfig) {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
  });

  const db = drizzle(pool, { schema });

  return {
    db,
    pool,
    async close() {
      await pool.end();
    },
  };
}
