// Database configuration types
export type DatabaseType = 'sqlite' | 'postgresql';

export interface SqliteConfig {
  type: 'sqlite';
  filename: string;
}

export interface PostgresConfig {
  type: 'postgresql';
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

export type DatabaseConfig = SqliteConfig | PostgresConfig;

import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { users, projects, deployments, settings } from './schema';

// Select types (what you get when reading from DB)
export type User = InferSelectModel<typeof users>;
export type Project = InferSelectModel<typeof projects>;
export type Deployment = InferSelectModel<typeof deployments>;
export type Setting = InferSelectModel<typeof settings>;

// Insert types (what you need when inserting to DB)
export type InsertUser = InferInsertModel<typeof users>;
export type InsertProject = InferInsertModel<typeof projects>;
export type InsertDeployment = InferInsertModel<typeof deployments>;
export type InsertSetting = InferInsertModel<typeof settings>;

// Project analysis result types
export interface AnalysisResult {
  framework: string;
  language: string;
  dependencies: Array<{
    name: string;
    version: string;
    type: 'dependency' | 'devDependency';
  }>;
  buildCommand?: string;
  startCommand?: string;
  port?: number;
  environmentVariables: string[];
  confidence: number;
  recommendations: string[];
  detectedIntegrations: Array<{
    service: string;
    type: string;
    required: boolean;
    envVars: string[];
  }>;
}

// Configuration generation result types
export interface GeneratedConfig {
  dockerfile?: string;
  dockerCompose?: string;
  vercelConfig?: string;
  railwayConfig?: string;
  envTemplate?: string;
  deploymentScript?: string;
}
