import type { DeploymentPlatform } from '@dxlander/shared';

/**
 * Pre-flight check result for a single check
 */
export interface PreFlightCheck {
  name: string;
  status: 'passed' | 'failed' | 'warning' | 'pending';
  message: string;
  fix?: string;
  details?: unknown;
}

/**
 * Pre-flight checks result
 */
export interface PreFlightResult {
  passed: boolean;
  checks: PreFlightCheck[];
}

/**
 * Options for running pre-flight checks
 */
export interface PreFlightOptions {
  configPath: string;
  userId: string;
  configSetId: string;
  provisionServiceNames?: string[];
}

/**
 * Progress event during deployment
 */
export interface DeployProgressEvent {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  details?: unknown;
}

/**
 * Options for deployment
 */
export interface DeployOptions {
  workDir: string;
  projectName: string;
  envVars: Record<string, string>;
  onProgress?: (event: DeployProgressEvent) => void;
}

/**
 * Result of a deployment operation
 */
export interface DeployResult {
  success: boolean;
  services?: string[];
  logs?: string;
  errorMessage?: string;
  deployUrl?: string;
  serviceUrls?: Array<{ service: string; url: string }>;
}

/**
 * Options for deleting a deployment
 */
export interface DeleteOptions {
  removeVolumes?: boolean;
  removeImages?: boolean | 'local' | 'all';
}

/**
 * Options for getting logs
 */
export interface LogOptions {
  tail?: number;
  service?: string;
  follow?: boolean;
}

/**
 * Result of getting logs
 */
export interface LogResult {
  buildLogs?: string;
  runtimeLogs?: string;
}

/**
 * Deployment executor interface
 *
 * All deployment targets (Docker, Railway, Vercel, etc.) must implement this interface.
 * This enables a pluggable architecture where adding a new deployment target
 * only requires creating a new executor class.
 */
export interface IDeploymentExecutor {
  /**
   * The platform this executor handles
   */
  readonly platform: DeploymentPlatform;

  /**
   * Run pre-flight checks before deployment
   * Should validate all requirements are met (e.g., Docker running, images exist)
   */
  runPreFlightChecks(options: PreFlightOptions): Promise<PreFlightResult>;

  /**
   * Deploy the application
   */
  deploy(options: DeployOptions): Promise<DeployResult>;

  /**
   * Start a stopped deployment
   */
  start(workDir: string, projectName: string): Promise<{ success: boolean; errorMessage?: string }>;

  /**
   * Stop a running deployment
   */
  stop(workDir: string, projectName: string): Promise<{ success: boolean; errorMessage?: string }>;

  /**
   * Restart a deployment
   */
  restart(
    workDir: string,
    projectName: string
  ): Promise<{ success: boolean; errorMessage?: string }>;

  /**
   * Delete/teardown a deployment
   */
  delete(workDir: string, projectName: string, options?: DeleteOptions): Promise<void>;

  /**
   * Get deployment logs
   */
  getLogs(workDir: string, projectName: string, options?: LogOptions): Promise<string>;

  /**
   * Get current deployment status
   */
  getStatus(
    workDir: string,
    projectName: string
  ): Promise<{
    running: boolean;
    services: Array<{ name: string; status: string; ports?: string[] }>;
  }>;

  /**
   * Get deployment URLs for running services
   */
  getDeployUrls(
    workDir: string,
    projectName: string,
    envVars?: Record<string, string>
  ): Promise<Array<{ service: string; url: string }>>;
}
