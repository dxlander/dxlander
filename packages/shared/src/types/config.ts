import { z } from 'zod';

/**
 * Configuration Generation Types
 *
 * Types for AI-generated deployment configurations (Docker, Kubernetes, etc.)
 */

/**
 * Supported configuration types for deployment
 */
export const ConfigTypeSchema = z.enum(['docker', 'docker-compose', 'kubernetes', 'bash']);
export type ConfigType = z.infer<typeof ConfigTypeSchema>;

/**
 * Configuration generation options
 */
export const GenerateConfigOptionsSchema = z.object({
  projectId: z.string().min(1),
  analysisId: z.string().min(1),
  configType: ConfigTypeSchema,
  userId: z.string().min(1),
});
export type GenerateConfigOptions = z.infer<typeof GenerateConfigOptionsSchema>;

/**
 * Configuration Set (backend/database version with Date objects)
 */
export interface ConfigSet {
  id: string;
  projectId: string;
  analysisRunId?: string;
  userId: string;
  name: string;
  type: string;
  version: number;
  localPath?: string;
  status: string;
  progress?: number;
  generatedBy: string;
  aiModel?: string;
  description?: string;
  tags?: string;
  notes?: string;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  createdAt: Date;
  updatedAt: Date;
  fileCount?: number;
}
