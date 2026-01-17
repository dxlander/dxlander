import { z } from 'zod';

/**
 * Deployment Types
 *
 * Types for managing deployments and deployment platform credentials.
 */

/**
 * Supported deployment platforms
 */
export type DeploymentPlatform =
  | 'docker'
  | 'vercel'
  | 'railway'
  | 'netlify'
  | 'aws'
  | 'gcp'
  | 'azure'
  | 'docker-registry'
  | 'kubernetes'
  | 'render'
  | 'fly-io'
  | 'digital-ocean'
  | 'heroku';

/**
 * Deployment status
 */
export type DeploymentStatus =
  | 'pending'
  | 'pre_flight'
  | 'building'
  | 'deploying'
  | 'running'
  | 'stopped'
  | 'failed'
  | 'terminated';

/**
 * Port mapping for container deployments
 */
export interface PortMapping {
  host: number;
  container: number;
  protocol?: 'tcp' | 'udp';
}

/**
 * Service URL for multi-service deployments
 */
export interface ServiceUrl {
  service: string;
  url: string;
}

/**
 * Pre-flight check result
 */
export interface PreFlightCheck {
  name: string;
  status: 'passed' | 'failed' | 'warning' | 'pending';
  message: string;
  fix?: string;
  details?: unknown;
}

/**
 * Pre-flight check result (serialized for API)
 */
export interface SerializedPreFlightCheck {
  name: string;
  status: 'passed' | 'failed' | 'warning' | 'pending';
  message: string;
  fix?: string;
  details?: unknown;
}

/**
 * Deployment (backend/database version with Date objects)
 */
export interface Deployment {
  id: string;
  projectId: string;
  configSetId?: string | null;
  buildRunId?: string | null;
  userId: string;
  name?: string | null;
  platform: DeploymentPlatform;
  environment: string;
  status: DeploymentStatus;
  containerId?: string | null;
  imageId?: string | null;
  imageTag?: string | null;
  ports?: PortMapping[] | null;
  exposedPorts?: number[] | null;
  deployUrl?: string | null;
  serviceUrls?: ServiceUrl[] | null;
  previewUrl?: string | null;
  buildLogs?: string | null;
  runtimeLogs?: string | null;
  errorMessage?: string | null;
  environmentVariables?: string | null;
  notes?: string | null;
  metadata?: Record<string, any> | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  stoppedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Serialized Deployment for API responses
 */
export type SerializedDeployment = Omit<
  Deployment,
  'startedAt' | 'completedAt' | 'stoppedAt' | 'createdAt' | 'updatedAt'
> & {
  startedAt?: string | null;
  completedAt?: string | null;
  stoppedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Deployment activity log entry
 */
export interface DeploymentActivityLog {
  id: string;
  deploymentId: string;
  action: string;
  result?: string | null;
  details?: Record<string, any> | null;
  timestamp: Date;
}

/**
 * Serialized deployment activity log
 */
export interface SerializedDeploymentActivityLog {
  id: string;
  deploymentId: string;
  action: string;
  result?: string | null;
  details?: Record<string, any> | null;
  timestamp: string;
}

/**
 * Input schema for creating deployments (AI-only mode)
 */
export const CreateDeploymentSchema = z.object({
  projectId: z.string().min(1),
  configSetId: z.string().min(1),
  platform: z.enum([
    'docker',
    'vercel',
    'railway',
    'netlify',
    'aws',
    'gcp',
    'azure',
    'docker-registry',
    'kubernetes',
    'render',
    'fly-io',
    'digital-ocean',
    'heroku',
  ]),
  name: z.string().optional(),
  environment: z.string().default('development'),
  integrationIds: z.array(z.string()).optional(),
  overrides: z.record(z.string()).optional(),
  notes: z.string().optional(),
  customInstructions: z.string().optional(),
  maxAttempts: z.number().min(1).max(5).default(3),
});
export type CreateDeploymentInput = z.infer<typeof CreateDeploymentSchema>;

/**
 * Deployment platform configuration
 */
export interface DeploymentPlatformConfig {
  platform: DeploymentPlatform;
  name: string;
  apiKey?: string;
  config?: Record<string, any>;
  settings?: Record<string, any>;
}

/**
 * Deployment Credential (backend/database version with Date objects)
 *
 * @example
 * ```typescript
 * const credential: DeploymentCredential = {
 *   id: "cred_123",
 *   userId: "user_456",
 *   name: "Production Vercel",
 *   platform: "vercel",
 *   settings: { region: "us-east-1" },
 *   isActive: true,
 *   isDefault: true,
 *   usageCount: 5,
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * };
 * ```
 */
export interface DeploymentCredential {
  id: string;
  userId: string;
  name: string;
  platform: DeploymentPlatform;
  settings?: Record<string, any>;
  isActive: boolean;
  isDefault: boolean;
  lastTested?: Date;
  lastTestStatus?: string;
  lastError?: string;
  usageCount: number;
  lastUsed?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Serialized Deployment Credential for API responses
 *
 * All Date fields are converted to ISO string format.
 */
export type SerializedDeploymentCredential = Omit<
  DeploymentCredential,
  'lastTested' | 'lastUsed' | 'createdAt' | 'updatedAt'
> & {
  lastTested?: string;
  lastUsed?: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Input schema for creating deployment credentials
 */
export const CreateDeploymentCredentialSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1, 'Credential name is required'),
  platform: z.enum([
    'vercel',
    'railway',
    'netlify',
    'aws',
    'gcp',
    'azure',
    'docker-registry',
    'kubernetes',
    'render',
    'fly-io',
    'digital-ocean',
    'heroku',
  ]),
  apiKey: z.string().optional(),
  config: z.record(z.any()).optional(),
  settings: z.record(z.any()).optional(),
  isDefault: z.boolean().optional(),
});
export type CreateDeploymentCredentialInput = z.infer<typeof CreateDeploymentCredentialSchema>;

/**
 * Input schema for updating deployment credentials
 */
export const UpdateDeploymentCredentialSchema = z.object({
  name: z.string().min(1).optional(),
  apiKey: z.string().optional(),
  config: z.record(z.any()).optional(),
  settings: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});
export type UpdateDeploymentCredentialInput = z.infer<typeof UpdateDeploymentCredentialSchema>;
