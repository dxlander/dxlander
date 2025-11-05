export {
  db,
  runMigrations,
  initializeDatabase,
  isSetupComplete,
  markSetupComplete,
  completeSetup,
  resetSetupState,
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
  integrations,
  deploymentCredentials,
  auditLogs,
} from './schema';
export type { User, Project, Deployment, Setting } from './types';

// Export new PostgreSQL support
export { createPostgresConnection } from './postgres-connection';
export type { DatabaseType, DatabaseConfig, SqliteConfig, PostgresConfig } from './types';
