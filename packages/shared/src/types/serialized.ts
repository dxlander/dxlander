import type { Project, Deployment, User } from './index';
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
 * // Backend returns Date objects
 * const project: Project = await db.query.projects.findFirst(...);
 *
 * // Frontend receives serialized strings
 * const { data: project } = trpc.projects.get.useQuery();
 * // project: SerializedProject (dates are strings)
 * ```
 */

/**
 * Serialized Project type for API responses
 *
 * All Date fields are converted to ISO string format.
 */
export type SerializedProject = Omit<Project, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

/**
 * Serialized Deployment type for API responses
 *
 * All Date fields are converted to ISO string format.
 */
export type SerializedDeployment = Omit<Deployment, 'deployedAt'> & {
  deployedAt: string;
};

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
};

/**
 * Re-export SerializedIntegrationVaultEntry from integration-vault.ts
 *
 * This type was already created in Issue #41.
 */
export type { SerializedIntegrationVaultEntry } from './integration-vault';
