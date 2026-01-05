import type { User } from './index';
import type { ConfigSet } from './config';

/**
 * Serialized versions of types for API responses
 *
 * tRPC automatically serializes Date objects to ISO strings when sending
 * data over the wire. These types reflect the actual shape of data that
 * the frontend receives from API calls.
 *
 * @example
 * ```typescript
 * // Backend returns Date objects from database
 * const project = await db.query.projects.findFirst(...);
 *
 * // Frontend receives serialized strings via tRPC
 * const { data: project } = trpc.projects.get.useQuery();
 * // project: SerializedProject (dates are strings)
 * ```
 */

/**
 * Serialized Project type for API responses
 *
 * This type matches exactly what Drizzle ORM returns from the database,
 * with Date objects serialized to ISO strings by tRPC.
 *
 * Note: Field types match the database schema inference:
 * - text() fields → string | null
 * - text().notNull() fields → string
 * - integer() fields → number | null
 * - timestamp fields → string (serialized from Date)
 */
export type SerializedProject = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  sourceType: string; // Drizzle infers enum as string
  sourceUrl: string | null;
  sourceHash: string;
  sourceBranch: string | null;
  localPath: string | null;
  filesCount: number | null;
  projectSize: number | null;
  language: string | null;
  status: string; // Drizzle infers enum as string
  latestAnalysisId: string | null;
  latestConfigSetId: string | null;
  lastDeployedAt: string | null; // Serialized from Date
  deployUrl: string | null;
  createdAt: string; // Serialized from Date
  updatedAt: string; // Serialized from Date
};

/**
 * Re-export SerializedDeployment from deployment.ts
 * (Comprehensive deployment types including serialized versions)
 */
export type {
  SerializedDeployment,
  SerializedDeploymentActivityLog,
  SerializedDeploymentCredential,
  SerializedPreFlightCheck,
} from './deployment';

/**
 * Serialized User type for API responses
 *
 * All Date fields are converted to ISO string format.
 */
export type SerializedUser = Omit<User, 'createdAt'> & {
  createdAt: string;
};

/**
 * Serialized ConfigSet type for API responses
 *
 * All Date fields are converted to ISO string format.
 */
export type SerializedConfigSet = Omit<
  ConfigSet,
  'startedAt' | 'completedAt' | 'createdAt' | 'updatedAt'
> & {
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  fileCount?: number; // Added by service layer
};

/**
 * Serialized AnalysisRun type for API responses
 *
 * All Date fields are converted to ISO string format.
 * Matches the database schema from analysisRuns table.
 */
export type SerializedAnalysisRun = {
  id: string;
  projectId: string;
  userId: string;
  version: number;
  status: string;
  progress: number | null;
  aiModel: string | null;
  aiProvider: string | null;
  confidence: number | null;
  results: string | null;
  errorMessage: string | null;
  errorDetails: string | null;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  createdAt: string;
  activityLog?: Array<{
    id: string;
    action: string;
    status: string;
    result?: string;
    details?: any;
    timestamp: string;
  }>; // Added by service layer
};

/**
 * Re-export SerializedSecret from secret.ts
 *
 * Renamed from SerializedIntegrationVaultEntry as part of Secret Manager refactor.
 */
export type { SerializedSecret } from './secret';
