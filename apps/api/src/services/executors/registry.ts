import type { DeploymentPlatform } from '@dxlander/shared';
import type { IDeploymentExecutor } from './types';

/**
 * Executor Registry
 *
 * Manages deployment executors for different platforms.
 * Provides a pluggable architecture where new deployment targets
 * can be added by registering new executors.
 *
 * Usage:
 *   const registry = new ExecutorRegistry();
 *   registry.register(new DockerDeploymentExecutor());
 *   registry.register(new RailwayDeploymentExecutor());
 *
 *   const executor = registry.get('docker');
 *   await executor.deploy(options);
 */
export class ExecutorRegistry {
  private executors = new Map<DeploymentPlatform, IDeploymentExecutor>();

  /**
   * Register a deployment executor
   */
  register(executor: IDeploymentExecutor): void {
    this.executors.set(executor.platform, executor);
  }

  /**
   * Get an executor for a specific platform
   * @throws Error if no executor is registered for the platform
   */
  get(platform: DeploymentPlatform): IDeploymentExecutor {
    const executor = this.executors.get(platform);
    if (!executor) {
      const supported = this.getSupportedPlatforms();
      throw new Error(
        `Deployment platform "${platform}" is not yet supported. ` +
          `Supported platforms: ${supported.join(', ') || 'none'}`
      );
    }
    return executor;
  }

  /**
   * Check if a platform is supported
   */
  has(platform: DeploymentPlatform): boolean {
    return this.executors.has(platform);
  }

  /**
   * Get list of supported platforms
   */
  getSupportedPlatforms(): DeploymentPlatform[] {
    return Array.from(this.executors.keys());
  }
}

/**
 * Global executor registry instance
 * Initialized with available executors in index.ts
 */
let globalRegistry: ExecutorRegistry | null = null;

/**
 * Get the global executor registry
 * Lazily initializes on first access
 */
export function getExecutorRegistry(): ExecutorRegistry {
  if (!globalRegistry) {
    globalRegistry = new ExecutorRegistry();
  }
  return globalRegistry;
}

/**
 * Set the global executor registry
 * Useful for testing or custom configurations
 */
export function setExecutorRegistry(registry: ExecutorRegistry): void {
  globalRegistry = registry;
}
