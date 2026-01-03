import { z } from 'zod';

/**
 * Configuration Generation Types
 *
 * We ALWAYS generate Docker + docker-compose.yml for every project.
 * This provides a universal deployment model that can be translated to other platforms.
 *
 * See: private_docs/deployment-restructure/00-OVERVIEW.md
 */

/**
 * Configuration generation options
 */
export const GenerateConfigOptionsSchema = z.object({
  projectId: z.string().min(1),
  analysisId: z.string().min(1),
  userId: z.string().min(1),
});
export type GenerateConfigOptions = z.infer<typeof GenerateConfigOptionsSchema>;

/**
 * Configuration Set
 */
export interface ConfigSet {
  id: string;
  projectId: string;
  analysisRunId?: string;
  userId: string;
  name: string;
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
