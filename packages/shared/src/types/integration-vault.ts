import { z } from 'zod';

/**
 * Integration Vault Types
 *
 * These types are for the user-managed integration credentials vault,
 * separate from the AI-detected integrations during project analysis.
 */

// Field for dynamic key-value credentials
export const IntegrationFieldSchema = z.object({
  key: z.string().min(1, 'Field key is required'),
  value: z.string().min(1, 'Field value is required'),
});
export type IntegrationField = z.infer<typeof IntegrationFieldSchema>;

// Service types
export type IntegrationServiceType =
  | 'DATABASE'
  | 'EMAIL'
  | 'PAYMENT'
  | 'CLOUD'
  | 'BACKEND'
  | 'API'
  | 'OTHER';

// Base integration vault entry (backend/database version with Date objects)
export interface IntegrationVaultEntry {
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
export interface SerializedIntegrationVaultEntry {
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
export const CreateIntegrationVaultEntrySchema = z.object({
  name: z.string().min(1, 'Integration name is required'),
  service: z.string().min(1, 'Service type is required'),
  fields: z.array(IntegrationFieldSchema).min(1, 'At least one field is required'),
  autoInjected: z.boolean().optional().default(true),
  projectId: z.string().optional(),
});
export type CreateIntegrationVaultEntryInput = z.infer<typeof CreateIntegrationVaultEntrySchema>;

export const UpdateIntegrationVaultEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  fields: z.array(IntegrationFieldSchema).optional(),
  autoInjected: z.boolean().optional(),
});
export type UpdateIntegrationVaultEntryInput = z.infer<typeof UpdateIntegrationVaultEntrySchema>;

// For internal service use
export interface CreateIntegrationServiceInput {
  userId: string;
  name: string;
  service: string;
  serviceType: string;
  credentialType: string;
  credentials: Record<string, any>;
  autoInjected?: boolean;
  projectId?: string;
}

export interface UpdateIntegrationServiceInput {
  name?: string;
  credentials?: Record<string, any>;
  autoInjected?: boolean;
}
