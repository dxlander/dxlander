import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { schema } from './schema';
import type { DatabaseStats, DatabaseTableStats } from './types';
import * as path from 'path';
import * as fs from 'fs';
import { homedir } from 'os';

// Determine data directory
// Always use ~/.dxlander/data for consistency
// Can be overridden with DXLANDER_HOME environment variable
function getDataDir(): string {
  if (process.env.DXLANDER_HOME) {
    return path.join(process.env.DXLANDER_HOME, 'data');
  }

  // Always use ~/.dxlander/data (same in development and production)
  return path.join(homedir(), '.dxlander', 'data');
}

const dataDir = getDataDir();
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Database path
const dbPath = path.join(dataDir, 'dxlander.db');

// Create SQLite connection
const sqlite = new Database(dbPath);

// Enable WAL mode for better performance
sqlite.pragma('journal_mode = WAL');

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });

// Migration function
export async function runMigrations() {
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Initialize database with default settings
export async function initializeDatabase() {
  try {
    // Create tables if they don't exist
    await createTables();

    // Check if setup is complete
    const setupSetting = await db.query.settings.findFirst({
      where: (settings, { eq }) => eq(settings.key, 'setup_complete'),
    });

    if (!setupSetting) {
      // Insert default settings
      await db.insert(schema.settings).values([
        {
          id: 'setup_complete',
          key: 'setup_complete',
          value: 'false',
          description: 'Whether initial setup has been completed',
        },
        {
          id: 'app_version',
          key: 'app_version',
          value: '0.1.0',
          description: 'Current application version',
        },
      ]);
    }
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

// Track if tables have been initialized
let tablesInitialized = false;

// Create tables if they don't exist
async function createTables() {
  try {
    // Create users table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT,
        role TEXT NOT NULL DEFAULT 'admin',
        is_active INTEGER NOT NULL DEFAULT 1,
        last_login_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Create projects table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        source_type TEXT NOT NULL,
        source_url TEXT,
        source_hash TEXT NOT NULL,
        source_branch TEXT,
        local_path TEXT,
        files_count INTEGER,
        project_size INTEGER,
        language TEXT,
        status TEXT NOT NULL DEFAULT 'imported',
        latest_analysis_id TEXT,
        latest_config_set_id TEXT,
        last_deployed_at INTEGER,
        deploy_url TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Create analysis_runs table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS analysis_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        ai_model TEXT,
        ai_provider TEXT,
        confidence INTEGER,
        results TEXT,
        error_message TEXT,
        error_details TEXT,
        started_at INTEGER,
        completed_at INTEGER,
        duration INTEGER,
        created_at INTEGER NOT NULL
      );
    `);

    // Create analysis_activity_logs table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS analysis_activity_logs (
        id TEXT PRIMARY KEY,
        analysis_run_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        action TEXT NOT NULL,
        result TEXT,
        details TEXT,
        created_at INTEGER NOT NULL
      );
    `);

    // Create config_sets table (always Docker + docker-compose.yml)
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS config_sets (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        analysis_run_id TEXT,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        version INTEGER NOT NULL,
        local_path TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        generated_by TEXT NOT NULL,
        ai_model TEXT,
        description TEXT,
        tags TEXT,
        notes TEXT,
        error_message TEXT,
        started_at INTEGER,
        completed_at INTEGER,
        duration INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Create config_files table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS config_files (
        id TEXT PRIMARY KEY,
        config_set_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT,
        file_type TEXT NOT NULL,
        content TEXT NOT NULL,
        description TEXT,
        language TEXT,
        is_valid INTEGER DEFAULT 1,
        validation_errors TEXT,
        size_bytes INTEGER,
        order_index INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Create config_optimizations table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS config_optimizations (
        id TEXT PRIMARY KEY,
        config_set_id TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        impact TEXT,
        estimated_savings TEXT,
        created_at INTEGER NOT NULL
      );
    `);

    // Create config_activity_logs table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS config_activity_logs (
        id TEXT PRIMARY KEY,
        config_set_id TEXT NOT NULL,
        action TEXT NOT NULL,
        result TEXT,
        details TEXT,
        timestamp INTEGER NOT NULL
      );
    `);

    // Create build_runs table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS build_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        config_set_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        build_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        image_size INTEGER,
        build_logs TEXT,
        error_message TEXT,
        started_at INTEGER,
        completed_at INTEGER,
        duration INTEGER,
        created_at INTEGER NOT NULL
      );
    `);

    // Create deployments table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS deployments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        config_set_id TEXT,
        build_run_id TEXT,
        user_id TEXT NOT NULL,
        name TEXT,
        platform TEXT NOT NULL,
        environment TEXT NOT NULL DEFAULT 'development',
        status TEXT NOT NULL DEFAULT 'pending',
        container_id TEXT,
        image_id TEXT,
        image_tag TEXT,
        ports TEXT,
        exposed_ports TEXT,
        deploy_url TEXT,
        preview_url TEXT,
        build_logs TEXT,
        runtime_logs TEXT,
        error_message TEXT,
        environment_variables TEXT,
        notes TEXT,
        metadata TEXT,
        started_at INTEGER,
        completed_at INTEGER,
        stopped_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Create deployment_activity_logs table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS deployment_activity_logs (
        id TEXT PRIMARY KEY,
        deployment_id TEXT NOT NULL,
        action TEXT NOT NULL,
        result TEXT,
        details TEXT,
        timestamp INTEGER NOT NULL
      );
    `);

    // Create config_integrations table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS config_integrations (
        id TEXT PRIMARY KEY,
        config_set_id TEXT NOT NULL,
        integration_id TEXT NOT NULL,
        overrides TEXT,
        order_index INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Create settings table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT,
        description TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Create encryption_keys table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS encryption_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        key_type TEXT NOT NULL DEFAULT 'master',
        encrypted_key TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        iv TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        is_default INTEGER NOT NULL DEFAULT 0,
        rotated_from TEXT,
        rotated_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER
      );
    `);

    // Create ai_providers table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS ai_providers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        encrypted_api_key TEXT,
        encrypted_config TEXT,
        settings TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        is_default INTEGER NOT NULL DEFAULT 0,
        last_tested INTEGER,
        last_test_status TEXT,
        last_error TEXT,
        usage_count INTEGER DEFAULT 0,
        last_used INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Create integrations table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS integrations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        service TEXT NOT NULL,
        service_type TEXT NOT NULL,
        credential_type TEXT NOT NULL,
        encrypted_credentials TEXT NOT NULL,
        detected_in TEXT,
        auto_injected INTEGER DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'unknown',
        last_tested INTEGER,
        last_error TEXT,
        usage_count INTEGER DEFAULT 0,
        last_used INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Create deployment_credentials table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS deployment_credentials (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        platform TEXT NOT NULL,
        encrypted_api_key TEXT,
        encrypted_config TEXT,
        settings TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        is_default INTEGER NOT NULL DEFAULT 0,
        last_tested INTEGER,
        last_test_status TEXT,
        last_error TEXT,
        usage_count INTEGER DEFAULT 0,
        last_used INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Create audit_logs table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        metadata TEXT,
        ip_address TEXT,
        user_agent TEXT,
        status TEXT NOT NULL,
        error_message TEXT,
        created_at INTEGER NOT NULL
      );
    `);

    // Only log once
    if (!tablesInitialized) {
      console.log('✅ Database initialized');
      tablesInitialized = true;
    }
  } catch (error) {
    console.error('❌ Failed to create tables:', error);
    throw error;
  }
}

// Complete setup with admin user
export async function completeSetup(
  adminEmail: string,
  adminPassword: string
): Promise<{ userId: string; email: string }> {
  try {
    const bcrypt = await import('bcryptjs');
    const { randomUUID } = await import('crypto');

    // Hash password
    const passwordHash = await bcrypt.default.hash(adminPassword, 12);

    // Create admin user
    const userId = randomUUID();
    await db.insert(schema.users).values({
      id: userId,
      email: adminEmail,
      passwordHash,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // NOTE: Encryption key creation is handled by the API layer
    // See: apps/api/src/services/encryption-key.service.ts
    // This keeps the database package independent and allows
    // the API to use the proper EncryptionService

    // Mark setup as complete
    await markSetupComplete();

    console.log('✅ Setup completed - Admin user created:', adminEmail);
    console.log('   ⚠️  Remember to create encryption key via EncryptionKeyService');
    return { userId, email: adminEmail };
  } catch (error) {
    console.error('Setup completion failed:', error);
    throw error;
  }
}

// Utility to check if setup is complete
export async function isSetupComplete(): Promise<boolean> {
  try {
    const setting = await db.query.settings.findFirst({
      where: (settings, { eq }) => eq(settings.key, 'setup_complete'),
    });

    return setting?.value === 'true';
  } catch (error) {
    console.error('Failed to check setup status:', error);
    return false;
  }
}

// Mark setup as complete
export async function markSetupComplete(): Promise<void> {
  try {
    await db
      .insert(schema.settings)
      .values({
        id: 'setup_complete_timestamp',
        key: 'setup_complete',
        value: 'true',
      })
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: {
          value: 'true',
          updatedAt: new Date(),
        },
      });

    console.log('Setup marked as complete');
  } catch (error) {
    console.error('Failed to mark setup as complete:', error);
    throw error;
  }
}

// Reset setup state for development/testing
export async function resetSetupState(): Promise<void> {
  try {
    // Clear runtime tables first to avoid foreign key issues
    await db.delete(schema.auditLogs);
    await db.delete(schema.deploymentCredentials);
    await db.delete(schema.deploymentActivityLogs);
    await db.delete(schema.deployments);
    await db.delete(schema.buildRuns);
    await db.delete(schema.configIntegrations);
    await db.delete(schema.configActivityLogs);
    await db.delete(schema.configOptimizations);
    await db.delete(schema.configFiles);
    await db.delete(schema.configSets);
    await db.delete(schema.analysisActivityLogs);
    await db.delete(schema.analysisRuns);
    await db.delete(schema.integrations);
    await db.delete(schema.aiProviders);
    try {
      sqlite.prepare('DELETE FROM encryption_keys;').run();
    } catch (error) {
      console.warn('Failed to clear encryption_keys table during reset:', error);
    }
    await db.delete(schema.projects);
    await db.delete(schema.settings);
    await db.delete(schema.users);

    // Re-initialize database defaults (settings, etc.)
    await initializeDatabase();

    console.log('Setup state has been reset');
  } catch (error) {
    console.error('Failed to reset setup state:', error);
    throw error;
  }
}

export default db;

/**
 * Return the absolute path to the SQLite database file used by the app
 */
export function getDatabaseFilePath(): string {
  return dbPath;
}

// Whitelist of valid table names for security (prevents SQL injection)
const VALID_TABLE_NAMES = new Set([
  'users',
  'projects',
  'analysis_runs',
  'analysis_activity_logs',
  'config_sets',
  'config_files',
  'config_optimizations',
  'config_activity_logs',
  'build_runs',
  'deployments',
  'deployment_activity_logs',
  'config_integrations',
  'settings',
  'encryption_keys',
  'ai_providers',
  'integrations',
  'deployment_credentials',
  'audit_logs',
]);

/**
 * Gather database statistics including file size, table counts, and per-table record counts.
 *
 * @returns Promise resolving to database statistics object containing:
 *   - dbPath: absolute path to the database file
 *   - fileSizeBytes: size of the SQLite file on disk
 *   - tablesCount: number of user tables (excluding SQLite internal tables)
 *   - totalRecords: sum of row counts across all user tables
 *   - perTable: array of { name, count } for each table
 */
export async function getDatabaseStats(): Promise<DatabaseStats> {
  try {
    // Use async file stat to avoid blocking event loop
    const stats = await fs.promises.stat(dbPath);

    // Get user tables (exclude sqlite internal tables)
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
      .all() as Array<{ name: string }>;

    let totalRecords = 0;
    const perTable: DatabaseTableStats[] = [];

    for (const t of tables) {
      // Security: Validate table name against whitelist to prevent SQL injection
      if (!VALID_TABLE_NAMES.has(t.name)) {
        console.warn(`Skipping unknown table: ${t.name}`);
        continue;
      }

      try {
        // Safe to use template literal here since table name is validated against whitelist
        const row = sqlite.prepare(`SELECT COUNT(*) as cnt FROM "${t.name}";`).get() as
          | { cnt: number }
          | undefined;
        const cnt = row?.cnt ?? 0;
        totalRecords += cnt;
        perTable.push({ name: t.name, count: cnt });
      } catch (err) {
        // If counting a table fails for any reason, skip it but continue
        console.error('Failed to count rows for table', t.name, err);
      }
    }

    return {
      dbPath,
      fileSizeBytes: stats.size,
      tablesCount: tables.length,
      totalRecords,
      perTable,
    };
  } catch (error) {
    console.error('Failed to collect database stats:', error);
    return {
      dbPath,
      fileSizeBytes: 0,
      tablesCount: 0,
      totalRecords: 0,
      perTable: [],
    };
  }
}
