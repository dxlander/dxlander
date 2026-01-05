/**
 * Deployment Executors
 *
 * This module provides a pluggable architecture for different deployment targets.
 * Each target (Docker, Railway, Vercel, etc.) has its own executor that implements
 * the IDeploymentExecutor interface.
 *
 * To add a new deployment target:
 * 1. Create a new executor file (e.g., railway.executor.ts)
 * 2. Implement the IDeploymentExecutor interface
 * 3. Register it in initializeExecutors() below
 */

export * from './types';
export * from './registry';
export { DockerDeploymentExecutor } from './docker.executor';

import { DockerDeploymentExecutor } from './docker.executor';
import { getExecutorRegistry } from './registry';

/**
 * Initialize all available executors
 * Called once at application startup
 */
export function initializeExecutors(): void {
  const registry = getExecutorRegistry();

  // Register Docker executor
  registry.register(new DockerDeploymentExecutor());

  // Future executors will be registered here:
  // registry.register(new RailwayDeploymentExecutor());
  // registry.register(new VercelDeploymentExecutor());
  // registry.register(new NetlifyDeploymentExecutor());
}
