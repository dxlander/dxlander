import { z } from 'zod';

/**
 * Secret Manager Types
 *
 * These types are for the user-managed secrets vault (renamed from Integration Vault).
 * Secrets are grouped credential sets that can be referenced by deployment configs.
 */

// Field for dynamic key-value credentials
export const SecretFieldSchema = z.object({
  key: z.string().min(1, 'Field key is required'),
  value: z.string().min(1, 'Field value is required'),
});
export type SecretField = z.infer<typeof SecretFieldSchema>;

// Service types for categorization
export type SecretServiceType =
  | 'DATABASE'
  | 'EMAIL'
  | 'PAYMENT'
  | 'CLOUD'
  | 'BACKEND'
  | 'API'
  | 'OTHER';

// Base secret entry (backend/database version with Date objects)
export interface Secret {
  id: string;
  userId: string;
  name: string;
  service: string;
  serviceType: string;
  credentialType: string;
  status: string;
  autoInjected: boolean;
  detectedIn?: string[] | null;
  lastTested?: Date | null;
  lastError?: string | null;
  usageCount: number;
  lastUsed?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  projectId?: string | null;
}

// Serialized version for API responses (dates as strings)
export interface SerializedSecret {
  id: string;
  userId: string;
  name: string;
  service: string;
  serviceType: string;
  credentialType: string;
  status: string;
  autoInjected: boolean;
  detectedIn?: string[] | null;
  lastTested?: string | null;
  lastError?: string | null;
  usageCount: number;
  lastUsed?: string | null;
  createdAt: string;
  updatedAt: string;
  projectId?: string | null;
}

// Input schemas for API operations
export const CreateSecretSchema = z.object({
  name: z.string().min(1, 'Secret name is required'),
  service: z.string().min(1, 'Service type is required'),
  fields: z.array(SecretFieldSchema).min(1, 'At least one field is required'),
  autoInjected: z.boolean().optional().default(true),
  projectId: z.string().optional(),
});
export type CreateSecretInput = z.infer<typeof CreateSecretSchema>;

export const UpdateSecretSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  fields: z.array(SecretFieldSchema).optional(),
  autoInjected: z.boolean().optional(),
});
export type UpdateSecretInput = z.infer<typeof UpdateSecretSchema>;

// For internal service use
export interface CreateSecretServiceInput {
  userId: string;
  name: string;
  service: string;
  serviceType: string;
  credentialType: string;
  credentials: Record<string, string>;
  autoInjected?: boolean;
  projectId?: string;
}

export interface UpdateSecretServiceInput {
  name?: string;
  credentials?: Record<string, string>;
  autoInjected?: boolean;
}
