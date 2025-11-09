import { z } from 'zod';

/**
 * Deployment Credential Types
 *
 * Types for managing deployment platform credentials (Vercel, Railway, etc.)
 * These are user-managed credentials for deploying to various platforms.
 */

/**
 * Supported deployment platforms
 */
export type DeploymentPlatform =
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
  platform: string;
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
  platform: z.string().min(1, 'Platform is required'),
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
