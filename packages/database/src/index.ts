export {
  db,
  runMigrations,
  initializeDatabase,
  isSetupComplete,
  markSetupComplete,
  completeSetup,
  resetSetupState,
  getDatabaseStats,
  getDatabaseFilePath,
} from './db';
export {
  schema,
  users,
  projects,
  deployments,
  settings,
  analysisRuns,
  analysisActivityLogs,
  configSets,
  configActivityLogs,
  configFiles,
  configOptimizations,
  buildRuns,
  aiProviders,
  secrets,
  deploymentCredentials,
  auditLogs,
} from './schema';
export type {
  User,
  Project,
  Deployment,
  Setting,
  DatabaseStats,
  DatabaseTableStats,
} from './types';

// Export new PostgreSQL support
export { createPostgresConnection } from './postgres-connection';
export type { DatabaseType, DatabaseConfig, SqliteConfig, PostgresConfig } from './types';
